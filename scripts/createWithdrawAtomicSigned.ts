import hre from "hardhat";

import { bigNumberify, expandDecimals } from "../utils/math";
import { parseError, getErrorString } from "../utils/error";
import * as keys from "../utils/keys";

import { WNT, ExchangeRouter } from "../typechain-types";
import { WithdrawalUtils } from "../typechain-types/contracts/exchange/WithdrawalHandler";

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

async function main() {
  console.log("run createWithdrawAtomicSigned - WBTC/testUSDC market on Monad");
  console.log("Using GmOracleProvider (signed mode) for atomic withdrawal\n");

  const withdrawalVault = await ethers.getContract("WithdrawalVault");
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

  const [wallet] = await ethers.getSigners();

  // For atomic withdrawal, no execution fee needed
  const executionFee = expandDecimals(0, 0);

  // WBTC synthetic market: indexToken=WBTC, longToken=testUSDC, shortToken=testUSDC
  const wbtcUsdcMarketAddress = "0x0f54E29bD585ce61F38Df2D9E8Cd4c865CE7784B";
  console.log("market %s", wbtcUsdcMarketAddress);

  // Get market token (GM token)
  const marketToken = await ethers.getContractAt("IERC20", wbtcUsdcMarketAddress);
  const marketTokenBalance = await marketToken.balanceOf(wallet.address);
  console.log("\nMarket token (GM) balance:", marketTokenBalance.toString());

  if (marketTokenBalance.eq(0)) {
    console.log("No market tokens to withdraw. Please deposit first.");
    return;
  }

  // Withdraw amount - withdraw all market tokens or specify amount
  // const withdrawAmount = marketTokenBalance; // withdraw all
  const withdrawAmount = expandDecimals(10, 18); // or specify amount

  // Check and approve market token for router
  const marketTokenAllowance = await marketToken.allowance(wallet.address, router.address);
  console.log("Market token allowance:", marketTokenAllowance.toString());
  if (marketTokenAllowance.lt(withdrawAmount)) {
    console.log("approving market token");
    await (marketToken as any).approve(router.address, bigNumberify(2).pow(256).sub(1));
  }

  // Withdrawal params for atomic withdrawal
  const params: WithdrawalUtils.CreateWithdrawalParamsStruct = {
    receiver: wallet.address,
    callbackContract: ethers.constants.AddressZero,
    uiFeeReceiver: ethers.constants.AddressZero,
    market: wbtcUsdcMarketAddress,
    longTokenSwapPath: [],
    shortTokenSwapPath: [],
    minLongTokenAmount: 0,
    minShortTokenAmount: 0,
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
  };

  // Fetch signed oracle params from API
  console.log("\n=== Fetching Oracle Params from API ===");
  const oracleParams = await fetchOracleParams(wallet.address, wbtcUsdcMarketAddress);
  console.log("Oracle params fetched successfully");
  console.log("Tokens:", oracleParams.tokens);
  console.log("Providers:", oracleParams.providers);

  console.log("\n=== Withdrawal Configuration ===");
  console.log("exchange router %s", exchangeRouter.address);
  console.log("withdrawal vault %s", withdrawalVault.address);
  console.log("withdraw amount %s", withdrawAmount.toString());
  console.log("creating atomic withdrawal %s", JSON.stringify(params));

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendTokens", [
      wbtcUsdcMarketAddress,
      withdrawalVault.address,
      withdrawAmount,
    ]),
    exchangeRouter.interface.encodeFunctionData("executeAtomicWithdrawal", [params, oracleParams]),
  ];
  console.log("\nmulticall args count:", multicallArgs.length);

  try {
    console.log("\nTesting atomic withdrawal simulation...");
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
    // Check balances after withdrawal
    const usdc = await ethers.getContractAt("IERC20", MONAD_TOKENS.testUSDC);
    const usdcBalance = await usdc.balanceOf(wallet.address);
    const newMarketTokenBalance = await marketToken.balanceOf(wallet.address);

    console.log("\n=== Result ===");
    console.log("testUSDC balance:", usdcBalance.toString());
    console.log("Market token (GM) balance:", newMarketTokenBalance.toString());
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
