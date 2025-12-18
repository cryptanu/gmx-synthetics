import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { OrderType, executeOrder } from "../../utils/order";
import { setTimeout } from 'timers/promises';
import { loadOracleParams } from "../../utils/exchangelive";
import { loadMarkets } from "../utils";
import { printOrder } from '../utils'
import { expandDecimals } from "../../utils/math";
import { createClient  } from "redis";
import { formatEther } from "ethers/lib/utils";
import { ZERO_ADDRESS } from "../../utils/constants";

const APP_INDEX=parseInt(process.env.APP_INDEX, 10);
const GAS_LIMIT = 800000;

const { ethers } = hre;
const { provider } = ethers;

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const rediscon = createClient();
  rediscon.on('error', (err) => console.error('Redis sender error', err));
  await rediscon.connect();

  const { orderKeepers } = fixture.accounts;
  
  const logKeeper = await Promise.all(orderKeepers.map(async (acc) => ({address: acc.address, balance: formatEther(await provider.getBalance(acc.address))})))
  console.log("Executer >> %s", JSON.stringify(logKeeper[APP_INDEX]))
    
  const { reader, dataStore, orderHandler} = fixture.contracts;

  const cachedMarkets = await loadMarkets();
  console.warn("use cached market list > %s", JSON.stringify(Object.keys(cachedMarkets), null, 2));

  while(true){
    console.log("waiting for task ....");
    const msg = await rediscon.blPop("ORDER_KEEPER", 0);
    const orderKey = msg.element;

    const oracleBlock = await provider.getBlock("latest");
    // const oracleBlock = await provider.getBlock(lastBlock.number - 1);
    try {
      const order = await reader.getOrder(dataStore.address, orderKey);
      
      await printOrder(order);
      
      const isMarketOrder = marketOrder(order);
      if (!isMarketOrder) {
        console.log('Order limit, ignore!');
        continue;
      }
    
      const tokenAddrs = collectTokenInfo(cachedMarkets, order);
      
      const oracleBlocks = Array(tokenAddrs.length).fill(oracleBlock, 0, tokenAddrs.length);
      const oraclePrice = await loadOracleParams(tokenAddrs);

      const execParams = {
        ...oraclePrice,
        orderKey: orderKey,
        oracleBlocks: oracleBlocks,
        executer: orderKeepers[APP_INDEX], 
      };
      await setTimeout(2000);
      const tx = await executeOrder(fixture, execParams)
      console.log('execute order success %s', tx.txReceipt.transactionHash);
    } catch (e) {
      try{
        console.warn("execute order failed > try to cancel %s > %s ...", orderKey, JSON.stringify(e));
        const order = await reader.getOrder(dataStore.address, orderKey);
        if (order[0].account == ZERO_ADDRESS) continue;
        const result = await orderHandler.connect(orderKeepers[APP_INDEX]).cancelOrder(orderKey, {
          gasLimit: GAS_LIMIT
        });
        console.warn("canceled order: %s -> %s", orderKey, JSON.stringify(result));
      }
      catch(e){
        console.error("cancel order got error >", e);
      }
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

function marketOrder(order) {
  const orderType = order.numbers.orderType
  const triggerPrice = order.numbers.triggerPrice

  const ignoreCheckTypes = [
    OrderType.LimitSwap,
    OrderType.MarketSwap,
    OrderType.MarketDecrease,
    OrderType.MarketIncrease,
    OrderType.Liquidation,
    OrderType.LimitDecrease,
    OrderType.StopLossDecrease,
  ];


  if (ignoreCheckTypes.includes(+orderType)) return true;
  return false;
  // const primaryPrice = {
  //   min: expandDecimals(oraclePrice.minPrices[0], oraclePrice.precisions[0]),
  //   max: expandDecimals(oraclePrice.maxPrices[0], oraclePrice.precisions[0]),
  // }
  // // for limit increase long positions:
  // //      - the order should be executed when the oracle price is <= triggerPrice
  // //      - primaryPrice.max should be used for the oracle price
  // // for limit increase short positions:
  // //      - the order should be executed when the oracle price is >= triggerPrice
  // //      - primaryPrice.min should be used for the oracle price
  // if (orderType == OrderType.LimitIncrease) {
  //   const ok = order.flags.isLong ? primaryPrice.max.lte(triggerPrice) : primaryPrice.min.gte(triggerPrice);
  //   if (!ok) return false;
  //   return true;
  // }

  // // for limit decrease long positions:
  // //      - the order should be executed when the oracle price is >= triggerPrice
  // //      - primaryPrice.min should be used for the oracle price
  // // for limit decrease short positions:
  // //      - the order should be executed when the oracle price is <= triggerPrice
  // //      - primaryPrice.max should be used for the oracle price
  // if (orderType == OrderType.LimitDecrease) {
  //   const ok = order.flags.isLong ? primaryPrice.min.gte(triggerPrice) : primaryPrice.max.lte(triggerPrice);
  //   if (!ok) return false
  //   return true;
  // }

  // // // for stop-loss decrease long positions:
  // // //      - the order should be executed when the oracle price is <= triggerPrice
  // // //      - primaryPrice.min should be used for the oracle price
  // // // for stop-loss decrease short positions:
  // // //      - the order should be executed when the oracle price is >= triggerPrice
  // // //      - primaryPrice.max should be used for the oracle price
  // if (orderType == OrderType.StopLossDecrease) {
  //   const ok = order.flags.isLong ? primaryPrice.min.lte(triggerPrice) : primaryPrice.max.gte(triggerPrice);
  //   if (!ok) return false
  //   return true;
  // }
}