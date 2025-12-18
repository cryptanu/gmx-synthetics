import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { executeOrder } from "../../utils/order";
import { setTimeout } from 'timers/promises';
import { loadOracleParams } from "../../utils/exchangelive";
import { loadMarkets } from "../utils";
import { formatEther } from "ethers/lib/utils";
import { prices as refPrices } from "../../utils/priceslive";
import { findAllLongLimitOrderTriggeredBy, findAllShotLimitOrderTriggeredBy } from "./graph/orderGraphQuery";
import { Block } from "@ethersproject/providers";

const APP_INDEX=parseInt(process.env.APP_INDEX, 10);

const { ethers } = hre;
const { provider } = ethers;

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const { orderKeepers } = fixture.accounts;

  const logKeeper = await Promise.all(orderKeepers.map(async (acc) => ({address: acc.address, balance: formatEther(await provider.getBalance(acc.address))})))
  console.log("Executer >> %s", JSON.stringify(logKeeper[APP_INDEX]))

  const cachedMarkets = await loadMarkets();
  console.warn("use cached market list > %s", JSON.stringify(Object.keys(cachedMarkets), null, 2));

  while(true){
    console.log("waiting for task ....");
    const oracleBlock = await provider.getBlock("latest");
    await triggerShortLimitOrder(cachedMarkets, fixture, oracleBlock);
    await setTimeout(5000);
  }
}

async function triggerShortLimitOrder(markets: any, fixture:any, oracleBlock: Block): Promise<void> {
  const { orderKeepers } = fixture.accounts;
  const marketAddresses = Object.keys(markets)

  for (let i = 0; i < marketAddresses.length; i++){
    const marketAddress = marketAddresses[i];
    const market = markets[marketAddress];
    const priceInfos = await refPrices();
    const price = priceInfos[market.indexToken];
    if(!price){
      console.warn('Not found price by market: ', marketAddress);
      continue;
    }

    //find & trigger short side
    const shortOrders = await findAllShotLimitOrderTriggeredBy(price.max, marketAddress);
    
    if(shortOrders.length > 0)
      console.log("Found ShortLimitOrders: ", JSON.stringify(shortOrders));
    
    for(let j = 0; j < shortOrders.length; j++){
      const order = shortOrders[j];
      try{
        const tokenAddresses = [market.indexToken, market.longToken, market.shortToken];
        const oracleBlocks = Array(tokenAddresses.length).fill(oracleBlock, 0, tokenAddresses.length);

        const oraclePrice = await loadOracleParams(tokenAddresses);
        const execParams = {
          ...oraclePrice,
          orderKey: order.id,
          oracleBlocks: oracleBlocks,
          executer: orderKeepers[APP_INDEX],
        };
        const tx = await executeOrder(fixture, execParams)
        console.log('execute short limit order success %s ==> %s', order.id, tx.txReceipt.transactionHash);
      }catch (e){
        console.error(`Error execute short limit order: ${order.id}`, e);
      }
    }

    //find & trigger long side
    const longOrders = await findAllLongLimitOrderTriggeredBy(price.min, marketAddress);
  
    if(longOrders.length > 0)
      console.log("Found LongLimitOrders: ", longOrders.map((order: { id: any }) => order.id));
    
    for (let j = 0; j < longOrders.length; j++) {
      const order = longOrders[j];
      try {
        const tokenAddresses = [market.marketToken, market.indexToken, market.longToken, market.shortToken];
        const oracleBlocks = Array(tokenAddresses.length).fill(oracleBlock, 0, tokenAddresses.length);
        const oraclePrice = await loadOracleParams(tokenAddresses);

        const execParams = {
          ...oraclePrice,
          orderKey: order.id,
          oracleBlocks: oracleBlocks,
          executer: orderKeepers[APP_INDEX],
        };
        
        const tx = await executeOrder(fixture, execParams);
        console.log("execute long limit order success %s ==> %s", order.id, tx.txReceipt.transactionHash);
      } catch (e) {
        console.log(`Error execute long limit order: ${order.id}`, e);
      }
    }
  }
}


async function triggerLongLimitOrder(markets: any, fixture: any, oracleBlock: Block): Promise<void> {
  const { orderKeepers } = fixture.accounts;
  const marketAddresses = Object.keys(markets);
  for (let i = 0; i < marketAddresses.length; i++) {
    const marketAddress = marketAddresses[i];
    const market = markets[marketAddress];
    const priceInfos = await refPrices();
    const price = priceInfos[market.indexToken];
    if(!price){
      console.warn('Not found price by market: ', marketAddress);
      continue;
    }

    const longOrders = await findAllLongLimitOrderTriggeredBy(price.min, marketAddress);
    console.log(
      "LoongOrders: ",
      longOrders.map((order: { id: any }) => order.id)
    );
    for (let j = 0; j < longOrders.length; j++) {
      const order = longOrders[j];
      try {
        const tokenAddresses = [market.marketToken, market.indexToken, market.longToken, market.shortToken];
        const oracleBlocks = Array(tokenAddresses.length).fill(oracleBlock, 0, tokenAddresses.length);
        const oraclePrice = await loadOracleParams(tokenAddresses);

        const execParams = {
          ...oraclePrice,
          orderKey: order.id,
          oracleBlocks: oracleBlocks,
          executer: orderKeepers[APP_INDEX],
        };
        const tx = await executeOrder(fixture, execParams);
        console.log("execute order success %s", tx.txReceipt.transactionHash);
      } catch (e) {
        console.log(`Error execute order: ${order.id}`, e);
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

