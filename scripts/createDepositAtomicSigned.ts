import hre from "hardhat";

import { bigNumberify, expandDecimals } from "../utils/math";
import { parseError, getErrorString } from "../utils/error";
import * as keys from "../utils/keys";

import { WNT, ExchangeRouter, MintableToken } from "../typechain-types";
import { DepositUtils } from "../typechain-types/contracts/exchange/DepositHandler";

const { ethers } = hre;

// Oracle API endpoint
const ORACLE_API_URL = "https://oracle-mainnet.bean.exchange/v1/oracle-params";

// Monad testnet token addresses
const MONAD_TOKENS = {
  WMON: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  WBTC: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
  testUSDC: "0x2BE286D3ff75E380ea9695D7cdA7e7292444C19E",
};

/**
 * Fetch oracle params from API
 */
async function fetchOracleParams(owner: string, market: string) {
  console.log("Fetching oracle params from:", ORACLE_API_URL);
  console.log("Request body:", { owner, market });

  const response = await fetch(ORACLE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ owner, market }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch oracle params: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
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

async function main() {
  console.log("run createDepositAtomicSigned - WBTC/testUSDC market on Monad");
  console.log("Using GmOracleProvider (signed mode) for atomic deposit\n");

  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");
  const dataStore = await ethers.getContract("DataStore");
  const gmOracleProvider = await ethers.getContract("GmOracleProvider");

  console.log("GmOracleProvider address:", gmOracleProvider.address);

  // Check if GmOracleProvider is atomic
  const isAtomic = await dataStore.getBool(keys.isAtomicOracleProviderKey(gmOracleProvider.address));
  const isEnabled = await dataStore.getBool(keys.isOracleProviderEnabledKey(gmOracleProvider.address));
  console.log(`GmOracleProvider: enabled=${isEnabled}, atomic=${isAtomic}`);

  if (!isAtomic) {
    console.log("\n⚠️  GmOracleProvider is NOT marked as atomic!");
    console.log("You need to set it as atomic first:");
    console.log(`dataStore.setBool(keys.isAtomicOracleProviderKey("${gmOracleProvider.address}"), true)`);
  }

  const { wnt } = await getValues();

  const [wallet] = await ethers.getSigners();

  // For atomic deposit, no execution fee needed
  const executionFee = expandDecimals(0, 0);

  const wntAllowance = await wnt.allowance(wallet.address, router.address);
  console.log("\nWNT address %s symbol %s", wnt.address, await wnt.symbol());
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
    executionFee: executionFee,
    callbackGasLimit: 0,
    initialLongToken: usdc.address,
    longTokenSwapPath: [],
    initialShortToken: usdc.address,
    shortTokenSwapPath: [],
    uiFeeReceiver: ethers.constants.AddressZero,
  };

  // Fetch signed oracle params from API
  console.log("\n=== Fetching Oracle Params from API ===");
  const oracleParams = await fetchOracleParams(wallet.address, wbtcUsdcMarketAddress);
  console.log("Oracle params fetched successfully");
  console.log("Tokens:", oracleParams.tokens);
  console.log("Providers:", oracleParams.providers);

  console.log("\n=== Deposit Configuration ===");
  console.log("exchange router %s", exchangeRouter.address);
  console.log("deposit vault %s", depositVault.address);
  console.log("creating atomic deposit %s", JSON.stringify(params));

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendTokens", [usdc.address, depositVault.address, totalDepositAmount]),
    exchangeRouter.interface.encodeFunctionData("executeAtomicDeposit", [params, oracleParams]),
  ];
  console.log("\nmulticall args count:", multicallArgs.length);

  try {
    console.log("\nTesting atomic deposit simulation...");
    await exchangeRouter.callStatic.multicall(multicallArgs);
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
    console.log("\nTrying to execute with estimateGas for more details...");
    try {
      await exchangeRouter.estimateGas.multicall(multicallArgs);
    } catch (estimateErr: any) {
      console.log("EstimateGas error:", estimateErr.reason || estimateErr.message);
    }
    throw e;
  }

  const tx = await exchangeRouter.multicall(multicallArgs);

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
