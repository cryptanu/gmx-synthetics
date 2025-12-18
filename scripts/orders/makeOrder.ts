import hre from "hardhat";
import { bigNumberify, expandDecimals } from "../../utils/math";
import { WNT, ExchangeRouter, MintableToken } from "../typechain-types";
import { parseUnits } from "ethers/lib/utils";
import { loadApiPrices } from "../../utils/priceslive";
import { OrderType } from "../../utils/order";

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
  const market = {
    "name": "WETH_USDC_USDC",
    "address": "0xF8074Be6fee9657bE60C9540DB8fAcE94F0F6DFC",
    "indexToken": "0x4F1471A645D3734653c3bfA2518FE790ec330216",
    "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
  }
  console.log("market %s", market);

  const orderVault = await ethers.getContract("OrderVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");
  const usdc: MintableToken = await ethers.getContract("USDC");

  const { wnt } = await getValues();
  const [wallet] = await ethers.getSigners();
  
  const price = await loadApiPrices();
  const acceptablePrice = price[market.indexToken]?.minPrice;
  console.log("acceptablePrice", acceptablePrice);

  const executionFee = parseUnits('0.3', 18);
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

  const longTokenAmount = expandDecimals(2, 6); // 0.01 weth
  const usdcAllowance = await usdc.allowance(wallet.address, router.address);
  const usdcBalance = await usdc.balanceOf(wallet.address);
  console.log("usdc balance %s", usdcBalance);
  console.log("usdc allowance %s", usdcAllowance.toString());
  if (usdcAllowance.lt(longTokenAmount)) {
    console.log("approving usdc");
    await usdc.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  
  const params = {
    addresses: {
      callbackContract: ethers.constants.AddressZero,
      initialCollateralToken: usdc.address,
      market: market.address,
      receiver: wallet.address,
      swapPath: [],
      uiFeeReceiver: ethers.constants.AddressZero,
    },
    numbers: {
      acceptablePrice,
      callbackGasLimit: 0,
      executionFee,
      initialCollateralDeltaAmount: 0,
      minOutputAmount: 0,
      sizeDeltaUsd: expandDecimals(4, 30),
      triggerPrice: 0,
    },
    orderType: OrderType.MarketIncrease, // MarketDecrease
    isLong: false, // not relevant for market swap
    shouldUnwrapNativeToken: false, // not relevant for market swap
    decreasePositionSwapType: 0, // no swap
    referralCode: ethers.constants.HashZero,
  };

  console.log("exchange router %s", exchangeRouter.address);
  console.log("order store %s", orderVault.address);

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendWnt", [orderVault.address, executionFee]),
    exchangeRouter.interface.encodeFunctionData("sendTokens", [usdc.address, orderVault.address, longTokenAmount]),
    exchangeRouter.interface.encodeFunctionData("createOrder", [params]),
  ];

  
  const tx = await exchangeRouter.multicall(multicallArgs, {
    value: executionFee,
  });

  console.log("transaction sent", tx.hash);
  await tx.wait();
}
main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });


