import hre from "hardhat";

import { bigNumberify } from "../../utils/math";
import { WNT, ExchangeRouter, MintableToken } from "../typechain-types";
import { DepositUtils } from "../typechain-types/contracts/exchange/DepositHandler";
import { parseUnits } from "ethers/lib/utils";

//@todo review order util function
const { ethers } = hre;

async function getValues(): Promise<{
  wnt: WNT;
}> {
  if (hre.network.name === "avalancheFuji") {
    return {
      wnt: await ethers.getContractAt("WNT", "0x1D308089a2D1Ced3f1Ce36B1FcaF815b07217be3"),
    };
  } else if (hre.network.name === "lineaGoerli") {
    return {
      wnt: await ethers.getContract("WMONAD"),
    };
  }

  throw new Error("unsupported network");
}

async function main() {
  console.log("run createDepositWethUsdc");
  const wethUsdMarketAddress = "0x724e33447026Df536F9beF057A36381946b9AA9B"

  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");
  const usdc: MintableToken = await ethers.getContract("USDC");
  const weth: MintableToken = await ethers.getContract("WETH");
  const { wnt } = await getValues();

  const [wallet] = await ethers.getSigners();
  
  const executionFee = parseUnits('0.2', 18); // 0.001 WNT
  console.log(executionFee.toString());
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

  const shortTokenAmount = parseUnits('2', 6);
  const usdcAllowance = await usdc.allowance(wallet.address, router.address);
  console.log("USDC address %s", usdc.address);
  console.log("USDC allowance %s", usdcAllowance.toString());
  if (usdcAllowance.lt(shortTokenAmount)) {
    console.log("approving USDC");
    await usdc.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  const usdcBalance = await usdc.balanceOf(wallet.address);
  console.log("USDC balance %s", usdcBalance);


  const params: DepositUtils.CreateDepositParamsStruct = {
    receiver: wallet.address,
    callbackContract: ethers.constants.AddressZero,
    market: wethUsdMarketAddress,
    minMarketTokens: 0,
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    initialLongToken: usdc.address,
    initialShortToken: usdc.address,
    longTokenSwapPath: [],
    shortTokenSwapPath: [],
    uiFeeReceiver: ethers.constants.AddressZero,
  };

  console.log("exchange router %s", exchangeRouter.address);
  console.log("deposit store %s", depositVault.address);
  console.log("creating deposit %s", (params));

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendWnt", [depositVault.address, executionFee]),
    exchangeRouter.interface.encodeFunctionData("sendTokens", [usdc.address, depositVault.address, shortTokenAmount]),
    exchangeRouter.interface.encodeFunctionData("createDeposit", [params]),
  ];

  
  const tx = await exchangeRouter.multicall(multicallArgs, {
    value: executionFee,
  });
  console.log("transaction sent", tx.hash);
  await tx.wait();
  console.log("receipt received");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
function expandDecimals(arg0: number, arg1: number) {
  throw new Error("Function not implemented.");
}

