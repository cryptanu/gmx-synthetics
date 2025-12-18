import hre from "hardhat";
import axios from "axios";

import { bigNumberify, expandDecimals } from "../utils/math";
import { parseError, getErrorString } from "../utils/error";
import * as keys from "../utils/keys";

import { WNT, ExchangeRouter, MintableToken } from "../typechain-types";
import { DepositUtils } from "../typechain-types/contracts/exchange/DepositHandler";

const { ethers } = hre;

// Monad testnet token addresses
const MONAD_TOKENS = {
  WMON: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  WBTC: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
  testUSDC: "0x2BE286D3ff75E380ea9695D7cdA7e7292444C19E",
};

// Pyth price feed IDs for Monad tokens
const PYTH_PRICE_FEED_IDS = {
  WBTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  testUSDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
};

// Pyth contract on Monad testnet
const PYTH_CONTRACT_ADDRESS = "0x2880aB155794e7179c9eE2e38200202908C17B43";

// Pyth Hermes API endpoint
const PYTH_HERMES_API = "https://hermes.pyth.network";

/**
 * Fetch latest price update data from Pyth Hermes API
 */
async function fetchPythPriceUpdateData(priceFeedIds: string[]): Promise<string[]> {
  const url = `${PYTH_HERMES_API}/v2/updates/price/latest`;
  const params = new URLSearchParams();
  priceFeedIds.forEach((id) => params.append("ids[]", id));

  console.log("Fetching Pyth price updates from Hermes API...");

  const response = await axios.get(url, { params });
  const data = response.data;

  if (!data.binary || !data.binary.data || data.binary.data.length === 0) {
    throw new Error("No price update data returned from Pyth Hermes API");
  }

  // Return the VAA data as hex strings
  return data.binary.data.map((vaa: string) => "0x" + vaa);
}

// Oracle providers on Monad - get from deployments
async function getOracleProviders() {
  const pythProvider = await ethers.getContract("PythPriceFeedProvider");
  const chainlinkProvider = await ethers.getContract("ChainlinkPriceFeedProvider");
  return {
    PythPriceFeedProvider: pythProvider.address,
    ChainlinkPriceFeedProvider: chainlinkProvider.address,
  };
}

async function getValues(): Promise<{
  wnt: WNT;
}> {
  if (hre.network.name === "monad") {
    return {
      wnt: await ethers.getContractAt("WNT", MONAD_TOKENS.WMON),
    };
  } else if (hre.network.name === "localhost") {
    return {
      wnt: await ethers.getContract("WETH"),
    };
  }

  throw new Error("unsupported network");
}

/**
 * Build oracle params for atomic deposit using PythPriceFeedProvider
 * PythPriceFeedProvider reads directly from Pyth on-chain, so no extra data needed
 */
function buildOracleParams(tokens: string[], provider: string) {
  return {
    tokens: tokens,
    providers: tokens.map(() => provider),
    data: tokens.map(() => "0x"), // PythPriceFeedProvider doesn't need extra data
  };
}

async function main() {
  console.log("run createDepositUsdcAtomic - WBTC/testUSDC market on Monad");
  console.log("Using PythPriceFeedProvider/ChainlinkPriceFeedProvider for atomic deposit\n");

  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");
  const dataStore = await ethers.getContract("DataStore");

  // Get oracle providers
  const ORACLE_PROVIDERS = await getOracleProviders();
  console.log("Oracle providers:", ORACLE_PROVIDERS);

  // Check which providers are atomic
  console.log("\n=== Checking Atomic Oracle Providers ===");
  for (const [name, address] of Object.entries(ORACLE_PROVIDERS)) {
    const isAtomic = await dataStore.getBool(keys.isAtomicOracleProviderKey(address));
    const isEnabled = await dataStore.getBool(keys.isOracleProviderEnabledKey(address));
    console.log(`${name} (${address}): enabled=${isEnabled}, atomic=${isAtomic}`);
  }

  // Check price feed config for tokens
  console.log("\n=== Checking Price Feed Config ===");
  const wbtcPriceFeed = await dataStore.getAddress(keys.priceFeedKey(MONAD_TOKENS.WBTC));
  const usdcPriceFeed = await dataStore.getAddress(keys.priceFeedKey(MONAD_TOKENS.testUSDC));
  console.log(`WBTC price feed: ${wbtcPriceFeed}`);
  console.log(`testUSDC price feed: ${usdcPriceFeed}`);

  // Check oracleProviderForToken config
  const wbtcOracleProvider = await dataStore.getAddress(keys.oracleProviderForTokenKey(MONAD_TOKENS.WBTC));
  const usdcOracleProvider = await dataStore.getAddress(keys.oracleProviderForTokenKey(MONAD_TOKENS.testUSDC));
  console.log(`WBTC oracle provider: ${wbtcOracleProvider}`);
  console.log(`testUSDC oracle provider: ${usdcOracleProvider}`);

  // Detect the situation
  if (wbtcPriceFeed === ORACLE_PROVIDERS.PythPriceFeedProvider) {
    console.log("\n⚠️  Current config: priceFeedKey points to PythPriceFeedProvider");
    console.log("This means the system is using Pyth for prices, but Pyth is NOT marked as atomic.");
    console.log("\nTo enable atomic deposits, you need to either:");
    console.log("1. Set PythPriceFeedProvider as atomic: dataStore.setBool(isAtomicOracleProviderKey(pythProvider), true)");
    console.log("2. OR configure real Chainlink price feeds for tokens");
  }

  const { wnt } = await getValues();

  const [wallet] = await ethers.getSigners();

  // For atomic deposit, no execution fee needed (user pays gas directly)
  // But we still need some WNT for the transaction
  const executionFee = expandDecimals(0, 0); // 0 for atomic deposit

  const wntAllowance = await wnt.allowance(wallet.address, router.address);
  console.log("WNT address %s symbol %s", wnt.address, await wnt.symbol());
  console.log("WNT allowance %s", wntAllowance.toString());
  if (wntAllowance.lt(expandDecimals(1, 18))) {
    console.log("approving WNT");
    await wnt.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  console.log("WNT balance %s", await wnt.balanceOf(wallet.address));

  const usdc: MintableToken = await ethers.getContractAt("MintableToken", MONAD_TOKENS.testUSDC);
  const totalDepositAmount = expandDecimals(100, 6); // 100 testUSDC total

  const usdcAllowance = await usdc.allowance(wallet.address, router.address);
  console.log("testUSDC address %s", usdc.address);
  console.log("testUSDC allowance %s", usdcAllowance.toString());
  if (usdcAllowance.lt(totalDepositAmount)) {
    console.log("approving testUSDC");
    await usdc.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  const usdcBalance = await usdc.balanceOf(wallet.address);
  console.log("testUSDC balance %s", usdcBalance);
  if (usdcBalance.lt(totalDepositAmount)) {
    console.log("minting %s testUSDC", totalDepositAmount.toString());
    await usdc.mint(wallet.address, totalDepositAmount);
  }

  // WBTC synthetic market: indexToken=WBTC, longToken=testUSDC, shortToken=testUSDC
  const wbtcUsdcMarketAddress = "0x0f54E29bD585ce61F38Df2D9E8Cd4c865CE7784B";
  console.log("market %s", wbtcUsdcMarketAddress);

  // Deposit params for atomic deposit
  const params: DepositUtils.CreateDepositParamsStruct = {
    receiver: wallet.address,
    callbackContract: ethers.constants.AddressZero,
    market: wbtcUsdcMarketAddress,
    minMarketTokens: 0,
    shouldUnwrapNativeToken: false,
    executionFee: executionFee, // 0 for atomic
    callbackGasLimit: 0,
    initialLongToken: usdc.address,
    longTokenSwapPath: [], // Must be empty for atomic deposit
    initialShortToken: usdc.address,
    shortTokenSwapPath: [], // Must be empty for atomic deposit
    uiFeeReceiver: ethers.constants.AddressZero,
  };

  // Build oracle params
  // For WBTC/testUSDC market, we need prices for: WBTC (index), testUSDC (long/short)
  const oracleTokens = [MONAD_TOKENS.WBTC, MONAD_TOKENS.testUSDC];

  // Use PythPriceFeedProvider since it's the one that has price data
  // NOTE: For this to work, PythPriceFeedProvider must be set as atomic!
  const atomicProvider = ORACLE_PROVIDERS.PythPriceFeedProvider;
  const oracleParams = buildOracleParams(oracleTokens, atomicProvider);

  console.log("\n=== Oracle Configuration ===");
  console.log("Oracle tokens:", oracleTokens);
  console.log("Oracle provider:", atomicProvider);
  console.log("NOTE: PythPriceFeedProvider must be marked as atomic for this to work!");
  console.log("Oracle params:", JSON.stringify(oracleParams, null, 2));

  console.log("\n=== Deposit Configuration ===");
  console.log("exchange router %s", exchangeRouter.address);
  console.log("deposit vault %s", depositVault.address);
  console.log("creating atomic deposit %s", JSON.stringify(params));

  // Update Pyth prices before atomic deposit
  console.log("\n=== Updating Pyth Prices ===");
  const priceFeedIds = [PYTH_PRICE_FEED_IDS.WBTC, PYTH_PRICE_FEED_IDS.testUSDC];
  console.log("Price feed IDs:", priceFeedIds);

  const priceUpdateData = await fetchPythPriceUpdateData(priceFeedIds);
  console.log("Fetched", priceUpdateData.length, "price update VAAs");

  // Get the Pyth contract to calculate update fee
  const pythAbi = [
    "function updatePriceFeeds(bytes[] calldata updateData) external payable",
    "function getUpdateFee(bytes[] calldata updateData) external view returns (uint256)",
  ];
  const pythContract = new ethers.Contract(PYTH_CONTRACT_ADDRESS, pythAbi, wallet);

  const updateFee = await pythContract.getUpdateFee(priceUpdateData);
  console.log("Pyth update fee:", updateFee.toString(), "wei");

  // Update Pyth prices
  console.log("Updating Pyth price feeds...");
  const updateTx = await pythContract.updatePriceFeeds(priceUpdateData, { value: updateFee });
  console.log("Update tx sent:", updateTx.hash);
  await updateTx.wait();
  console.log("Pyth prices updated successfully!");

  // For atomic deposit, we use multicall with:
  // 1. sendTokens (deposit amount)
  // 2. executeAtomicDeposit (creates and executes in one tx)
  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendTokens", [usdc.address, depositVault.address, totalDepositAmount]),
    exchangeRouter.interface.encodeFunctionData("executeAtomicDeposit", [params, oracleParams]),
  ];
  console.log("\nmulticall args count:", multicallArgs.length);

  // Test fetching price from the new PythPriceFeedProvider first
  console.log("\n=== Testing PythPriceFeedProvider ===");
  const pythProviderContract = await ethers.getContractAt(
    "PythPriceFeedProvider",
    atomicProvider
  );
  try {
    const wbtcPrice = await pythProviderContract.callStatic.getOraclePrice(MONAD_TOKENS.WBTC, "0x");
    // ValidatedPrice struct: [token, min, max, timestamp, provider]
    console.log("WBTC price from PythPriceFeedProvider:", {
      token: wbtcPrice.token || wbtcPrice[0],
      min: (wbtcPrice.min || wbtcPrice[1]).toString(),
      max: (wbtcPrice.max || wbtcPrice[2]).toString(),
      timestamp: (wbtcPrice.timestamp || wbtcPrice[3]).toString(),
    });

    const usdcPrice = await pythProviderContract.callStatic.getOraclePrice(MONAD_TOKENS.testUSDC, "0x");
    console.log("testUSDC price from PythPriceFeedProvider:", {
      token: usdcPrice.token || usdcPrice[0],
      min: (usdcPrice.min || usdcPrice[1]).toString(),
      max: (usdcPrice.max || usdcPrice[2]).toString(),
      timestamp: (usdcPrice.timestamp || usdcPrice[3]).toString(),
    });
  } catch (e: any) {
    console.error("Error fetching price from PythPriceFeedProvider:", e.reason || e.message);
    throw e;
  }

  // Gas limit for atomic deposit - needs to be high enough for the deposit execution
  // Gas estimate is ~3.2M, but actual execution may need more
  const gasLimit = 5000000; // 5M gas

  // Test with callStatic first
  try {
    console.log("\nTesting atomic deposit simulation...");
    await exchangeRouter.callStatic.multicall(multicallArgs, {
      gasLimit,
    });
    console.log("Simulation OK, sending transaction...");
  } catch (e: any) {
    console.error("Simulation FAILED:", e.reason || e.message);
    if (e.data && e.data !== "0x") {
      try {
        const errorReason = parseError(e.data);
        console.log("parsed error:", getErrorString(errorReason));
      } catch (parseErr) {
        console.log("could not parse error, raw data:", e.data?.slice(0, 100));
      }
    }
    // Try to get more detailed error
    console.log("\nTrying to execute with estimateGas for more details...");
    try {
      await exchangeRouter.estimateGas.multicall(multicallArgs, { gasLimit });
    } catch (estimateErr: any) {
      console.log("EstimateGas error:", estimateErr.reason || estimateErr.message);
    }
    throw e;
  }

  const tx = await exchangeRouter.multicall(multicallArgs, {
    gasLimit,
  });

  console.log("\ntransaction sent", tx.hash);
  const receipt = await tx.wait();
  console.log("receipt received, gas used:", receipt.gasUsed.toString());
  console.log("status:", receipt.status === 1 ? "SUCCESS" : "FAILED");

  if (receipt.status === 1) {
    // Check market token balance
    const marketToken = await ethers.getContractAt("IERC20", wbtcUsdcMarketAddress);
    const marketTokenBalance = await marketToken.balanceOf(wallet.address);
    console.log("\n=== Result ===");
    console.log("Market token (GM) balance:", marketTokenBalance.toString());
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
