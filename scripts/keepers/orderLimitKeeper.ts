/**
 * @todo review limit order keeper
 */
import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import {
  getOrderKeys,
  OrderType,
  makeExecuteOrderParams,
  executeOrder,
  getLimitOrderFromSubgraph
} from "../../utils/order";
import { setTimeout } from 'timers/promises';
import { loadOracleParams } from "../../utils/exchangelive";
import { loadMarkets } from "../utils";
import { printOrder } from '../utils'
import { expandDecimals } from "../../utils/math";
import { createClient } from "redis";

const { ethers } = hre;
const { provider } = ethers;

const CHANNEL = "keeper_order_cancel";

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const { reader, dataStore, orderHandler, multicallInternal } = fixture.contracts;

  const publisher = createClient();
  publisher.on('error', (err) => console.error('Redis sender error', err));
  await publisher.connect();
  console.log("Redis status: open %s , ready %s ", publisher.isOpen, publisher.isReady);


  const cachedMarkets = await loadMarkets();
  console.warn("use cached market list > %s", JSON.stringify(Object.keys(cachedMarkets), null, 2));

  while (true) {
    await setTimeout(2000);
    console.log("------------------------ scanning all orders ------------------------");
    try {
      const limitOrders = await getLimitOrderFromSubgraph();
      const orderKeys = limitOrders.map((order: { id: any }) => order.id);
      console.log(orderKeys)

      let oracleBlock = undefined;
      if (orderKeys.length > 0) {
        oracleBlock = await provider.getBlock("latest");
        console.log("using block hash: " + oracleBlock.hash + ", timestamp: " + oracleBlock.timestamp + ", block#: " + oracleBlock.number)
      }

      for (const orderKey of orderKeys) {
        try {
            const order = await reader.getOrder(dataStore.address, orderKey);

            await printOrder(order);

            const tokenAddrs = collectTokenInfo(cachedMarkets, order);

            const oracleBlocks = Array(tokenAddrs.length).fill(oracleBlock, 0, tokenAddrs.length);
            const oraclePrice = await loadOracleParams(tokenAddrs);

            const execParams = {
              ...oraclePrice,
              orderKey: orderKey,
              oracleBlocks: oracleBlocks
            };

            const isValid = isValidOrderPrice(order, oraclePrice);
            if (!isValid) {
              console.log('Order trigger price invalid, ignore!');
              continue;
            }

            await executeOrder(fixture, execParams)
            console.log('execute order success');
          } catch (e) {
            console.error("execute order failed! sending to recover fund: %s --> %s !", JSON.stringify(orderKey), e);
            await publisher.publish(CHANNEL, orderKey);
          }
        }
    } catch (error) {
      console.error("Get orders keys error %s", error);
    }
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


function collectTokenInfo(markets: any, order: any) {
  const tokenAddrs = [order.addresses.market]
    .concat(order.addresses.swapPath)
    .filter(marketToken => marketToken !== undefined)
    .flatMap(marketToken => {
      const market = markets[marketToken];
      return market ? [market.indexToken, market.longToken, market.shortToken] : []
    })
    .concat([order.addresses.initialCollateralToken])
    .filter(_addr => (_addr !== undefined) && (_addr !== ethers.constants.AddressZero))

  return [...new Set(tokenAddrs)];
}

function isValidOrderPrice(order, oraclePrice) {
  const orderType = order.numbers.orderType
  const triggerPrice = order.numbers.triggerPrice

  const ignoreCheckTypes = [
    OrderType.LimitSwap,
    OrderType.MarketSwap,
    OrderType.MarketDecrease,
    OrderType.MarketIncrease,
    OrderType.Liquidation
  ];


  if (ignoreCheckTypes.includes(+orderType)) return true;
  return false;
  const primaryPrice = {
    min: expandDecimals(oraclePrice.minPrices[0], oraclePrice.precisions[0]),
    max: expandDecimals(oraclePrice.maxPrices[0], oraclePrice.precisions[0]),
  }
  // for limit increase long positions:
  //      - the order should be executed when the oracle price is <= triggerPrice
  //      - primaryPrice.max should be used for the oracle price
  // for limit increase short positions:
  //      - the order should be executed when the oracle price is >= triggerPrice
  //      - primaryPrice.min should be used for the oracle price
  if (orderType == OrderType.LimitIncrease) {
    const ok = order.flags.isLong ? primaryPrice.max.lte(triggerPrice) : primaryPrice.min.gte(triggerPrice);
    if (!ok) return false;
    return true;
  }

  // for limit decrease long positions:
  //      - the order should be executed when the oracle price is >= triggerPrice
  //      - primaryPrice.min should be used for the oracle price
  // for limit decrease short positions:
  //      - the order should be executed when the oracle price is <= triggerPrice
  //      - primaryPrice.max should be used for the oracle price
  if (orderType == OrderType.LimitDecrease) {
    const ok = order.flags.isLong ? primaryPrice.min.gte(triggerPrice) : primaryPrice.max.lte(triggerPrice);
    if (!ok) return false
    return true;
  }

  // // for stop-loss decrease long positions:
  // //      - the order should be executed when the oracle price is <= triggerPrice
  // //      - primaryPrice.min should be used for the oracle price
  // // for stop-loss decrease short positions:
  // //      - the order should be executed when the oracle price is >= triggerPrice
  // //      - primaryPrice.max should be used for the oracle price
  if (orderType == OrderType.StopLossDecrease) {
    const ok = order.flags.isLong ? primaryPrice.min.lte(triggerPrice) : primaryPrice.max.gte(triggerPrice);
    if (!ok) return false
    return true;
  }
}
