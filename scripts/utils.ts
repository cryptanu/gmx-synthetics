import hre from "hardhat";
import { BigNumber } from "ethers";
import * as keys from "../utils/keys";
import { assert } from "console";
import { ZERO_ADDRESS } from "../utils/constants";

export function toLoggableObject(obj: any): any {
  if (obj instanceof BigNumber) {
    return obj.toString();
  } else if (typeof obj === "object") {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      if (isNaN(Number(key))) {
        newObj[key] = toLoggableObject(obj[key]);
      } else {
        delete newObj[key];
      }
    }
    return newObj;
  } else if (Array.isArray(obj)) {
    return obj.map(toLoggableObject);
  } else {
    return obj;
  }
}

export async function printDeposit(deposit) {
  console.log("[");
  console.log("market: %s", deposit.addresses.market);
  console.log("account: %s", deposit.addresses.account);
  console.log("receiver: %s", deposit.addresses.receiver);
  console.log("callbackContract: %s", deposit.addresses.callbackContract);
  console.log("uiFeeReceiver: %s", deposit.addresses.uiFeeReceiver);
  console.log("initialLongToken: %s", deposit.addresses.initialLongToken);
  console.log("initialShortToken: %s", deposit.addresses.initialShortToken);
  console.log("longTokenSwapPath: %s", deposit.addresses.longTokenSwapPath);
  console.log("shortTokenSwapPath: %s", deposit.addresses.shortTokenSwapPath);
  console.log("minMarketTokens: %s", deposit.numbers.minMarketTokens);
  console.log("initialLongTokenAmount: %s", deposit.numbers.initialLongTokenAmount);
  console.log("initialShortTokenAmount: %s", deposit.numbers.initialShortTokenAmount);
  console.log("updatedAtBlock: %s", deposit.numbers.updatedAtBlock);
  console.log("executionFee: %s", deposit.numbers.executionFee);
  console.log("callbackGasLimit: %s", deposit.numbers.callbackGasLimit);
  console.log("]");
}

export async function printWithdrawal(withdrawal) {
  console.log("[");
  console.log("account: %s", withdrawal.addresses.account);
  console.log("receiver: %s", withdrawal.addresses.receiver);
  console.log("callbackContract: %s", withdrawal.addresses.callbackContract);
  console.log("uiFeeReceiver: %s", withdrawal.addresses.uiFeeReceiver);
  console.log("market: %s", withdrawal.addresses.market);
  console.log("longTokenSwapPath: %s", withdrawal.addresses.longTokenSwapPath);
  console.log("shortTokenSwapPath: %s", withdrawal.addresses.shortTokenSwapPath);
  console.log("marketTokenAmount: %s", withdrawal.numbers.marketTokenAmount);
  console.log("minLongTokenAmount: %s", withdrawal.numbers.minLongTokenAmount);
  console.log("minShortTokenAmount: %s", withdrawal.numbers.minShortTokenAmount);
  console.log("updatedAtBlock: %s", withdrawal.numbers.updatedAtBlock);
  console.log("executionFee: %s", withdrawal.numbers.executionFee);
  console.log("callbackGasLimit: %s", withdrawal.numbers.callbackGasLimit);
  console.log("shouldUnwrapNativeToken: %s", withdrawal.flags.shouldUnwrapNativeToken);
  console.log("]");
}

export async function printOrder(order) {
  console.log("[");
  console.log("account: %s", order.addresses.account);
  console.log("receiver: %s", order.addresses.receiver);
  console.log("callbackContract: %s", order.addresses.callbackContract);
  console.log("uiFeeReceiver: %s", order.addresses.uiFeeReceiver);
  console.log("market: %s", order.addresses.market);
  console.log("initialCollateralToken: %s", order.addresses.initialCollateralToken);
  console.log("swapPath: %s", order.addresses.swapPath);

  console.log("orderType: %s", order.numbers.orderType);
  console.log("decreasePositionSwapType: %s", order.numbers.decreasePositionSwapType);
  console.log("sizeDeltaUsd: %s", order.numbers.sizeDeltaUsd);
  console.log("initialCollateralDeltaAmount: %s", order.numbers.initialCollateralDeltaAmount);
  console.log("triggerPrice: %s", order.numbers.triggerPrice);
  console.log("acceptablePrice: %s", order.numbers.acceptablePrice);
  console.log("callbackGasLimit: %s", order.numbers.callbackGasLimit);
  console.log("minOutputAmount: %s", order.numbers.minOutputAmount);
  console.log("updatedAtBlock: %s", order.numbers.updatedAtBlock);

  console.log("isLong: %s", order.flags.isLong);
  console.log("shouldUnwrapNativeToken: %s", order.flags.shouldUnwrapNativeToken);
  console.log("isFrozen: %s", order.flags.isFrozen);

  console.log("]");
}

export async function printPosition(pos) {
  console.log("[");
  console.log("account: %s", pos.addresses.account);
  console.log("market: %s", pos.addresses.market);
  console.log("collateralToken: %s", pos.addresses.collateralToken);
  console.log("sizeInUsd: %s", pos.numbers.sizeInUsd);
  console.log("sizeInTokens: %s", pos.numbers.sizeInTokens);
  console.log("collateralAmount: %s", pos.numbers.collateralAmount);
  console.log("borrowingFactor: %s", pos.numbers.borrowingFactor);
  console.log("fundingFeeAmountPerSize: %s", pos.numbers.fundingFeeAmountPerSize);
  console.log("longTokenClaimableFundingAmountPerSize: %s", pos.numbers.longTokenClaimableFundingAmountPerSize);
  console.log("shortTokenClaimableFundingAmountPerSize: %s", pos.numbers.shortTokenClaimableFundingAmountPerSize);
  console.log("increasedAtBlock: %s", pos.numbers.increasedAtBlock);
  console.log("decreasedAtBlock: %s", pos.numbers.decreasedAtBlock);
  console.log("isLong: %s", pos.flags.isLong);
  console.log("]");
}

/**
 * @dev print liquidation info from onchain
 * @param posKey 
 * @param liq 
 */
export async function printLiquidationInfo(posKey, liq) {
  console.log("Onchain Liq info ==> ");
  console.log("[");
  console.log("positionKey %s", posKey);
  console.log("shouldLiq: %s", liq[0]);
  console.log("message: %s", liq[1]);
  console.log("remainingCollateralUsd: %s", liq[2].remainingCollateralUsd);
  console.log("minCollateralUsd %s", liq[2].minCollateralUsd);
  console.log("minCollateralUsdForLeverage: %s", liq[2].minCollateralUsdForLeverage);
  console.log("]");
}

export function printStrategyVault(info) {
  console.log('PNL: %s', info.pnl);
  console.log('Tvl: %s', info.tvl);
  console.log('jlpAddress: ', info.jlpAddress)
  console.log('jlpSupply: ', info.jlpSupply.toString())
  console.log('slpAddress: ', info.slpAddress)
  console.log('slpSupply: ', info.slpSupply.toString())
  console.log('bonusToken: ', info.rewardToken)
  console.log('bonusApy: ', info.rewardApy.toString())
  console.log('=============\nMarkets:');

  for (let index = 0; index < info.perpMarkets.length; index++) {
    if (info.perpMarkets[index] === ZERO_ADDRESS) continue;
    const market = info.perpMarkets[index];
    console.log("%s. %s", index + 1, market.market);
    console.log('tvl : %s', market.tvl);
    console.log('pnl : %s', market.pnl);
    console.log('share : %s', market.share);
    console.log('sharePrice : %s', market.sharePrice);
  }
}

/**
 * 
 * Load all markets from chain
 */
export async function loadMarkets() {
  const reader = await hre.ethers.getContract("Reader");
  const dataStore = await hre.ethers.getContract("DataStore");
  console.warn("loading max upto 100 markets ...");
  let markets = [...(await reader.getMarkets(dataStore.address, 0, 100))];
  const all = {};
  for (const market of markets) {
    all[market.marketToken] = market;
  }
  return all;
}

/**
 * @todo load deployed tokens.
 * Should extend to synthertic tokens & external deployed tokens
 * Should filter with a whitlist
 */
export async function getTokens() {
  const wnt = await hre.ethers.getContract("WETH");
  const wbtc = await hre.ethers.getContract("WBTC");
  const usdc = await hre.ethers.getContract("USDC");
  const usdt = await hre.ethers.getContract("USDT");
  const sol = await hre.ethers.getContract("SOL");
  const doge = await hre.ethers.getContract("DOGE");
  const tokens = {};
  tokens[wnt.address] = wnt;
  tokens[wbtc.address] = wbtc;
  tokens[usdc.address] = usdc;
  tokens[usdt.address] = usdt;
  tokens[sol.address] = sol;
  tokens[doge.address] = doge;
  return tokens;
}

export async function getMarket(marketToken) {
  const reader = await hre.ethers.getContract("Reader");
  const dataStore = await hre.ethers.getContract("DataStore");
  const market = (await reader.getMarkets(dataStore.address, marketToken));
  assert(marketToken === market.marketToken, "Market unmatched!");
  market.isDisabled = await dataStore.getBool(keys.isMarketDisabledKey(marketToken));
}

export async function printMarket(market) {
  console.log("[");
  console.log("marketToken: %s", market.marketToken);
  console.log("indexToken: %s", market.indexToken);
  console.log("longToken: %s", market.longToken);
  console.log("shortToken: %s", market.shortToken);
  console.log("]");
}