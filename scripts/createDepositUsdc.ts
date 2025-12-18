import hre from "hardhat";

import { bigNumberify, expandDecimals } from "../utils/math";

import { WNT, ExchangeRouter, MintableToken } from "../typechain-types";
import { DepositUtils } from "../typechain-types/contracts/exchange/DepositHandler";

const { ethers } = hre;

// Monad testnet token addresses
const MONAD_TOKENS = {
  WMON: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  WBTC: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
  testUSDC: "0x2BE286D3ff75E380ea9695D7cdA7e7292444C19E",
};

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
  console.log("run createDepositUsdc - WMON/testUSDC market on Monad");
  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");

  const { wnt } = await getValues();

  const [wallet] = await ethers.getSigners();

  const gasPrice = await ethers.provider.getGasPrice();
  const estimatedGas = bigNumberify(3_000_000);
  const executionFee = gasPrice.mul(estimatedGas);
  console.log("Gas price: %s gwei, Execution fee: %s WNT",
    ethers.utils.formatUnits(gasPrice, "gwei"),
    ethers.utils.formatEther(executionFee)
  );
  if ((await wnt.balanceOf(wallet.address)).lt(executionFee)) {
    console.log("depositing %s WNT", executionFee.toString());
    await wnt.deposit({ value: executionFee });
  }

  const wntAllowance = await wnt.allowance(wallet.address, router.address);
  console.log("WNT address %s symbol %s", wnt.address, await wnt.symbol());
  console.log("WNT allowance %s", wntAllowance.toString());
  if (wntAllowance.lt(executionFee)) {
    console.log("approving WNT");
    await wnt.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  console.log("WNT balance %s", await wnt.balanceOf(wallet.address));

  const usdc: MintableToken = await ethers.getContractAt("MintableToken", MONAD_TOKENS.testUSDC);
  const totalDepositAmount = expandDecimals(200, 6); // 200 testUSDC total

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

  const wbtcUsdcMarketAddress = "0x0f54E29bD585ce61F38Df2D9E8Cd4c865CE7784B";
  console.log("market %s", wbtcUsdcMarketAddress);

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
  console.log("exchange router %s", exchangeRouter.address);
  console.log("deposit store %s", depositVault.address);
  console.log("creating deposit %s", JSON.stringify(params));

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendWnt", [depositVault.address, executionFee]),
    exchangeRouter.interface.encodeFunctionData("sendTokens", [usdc.address, depositVault.address, totalDepositAmount]),
    exchangeRouter.interface.encodeFunctionData("createDeposit", [params]),
  ];
  console.log("multicall args", multicallArgs);

  const tx = await exchangeRouter.multicall(multicallArgs, {
    value: executionFee,
    gasLimit: 2500000,
  });

  console.log("transaction sent", tx.hash);
  const receipt = await tx.wait();
  console.log("receipt received, gas used:", receipt.gasUsed.toString());
  console.log("status:", receipt.status);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
