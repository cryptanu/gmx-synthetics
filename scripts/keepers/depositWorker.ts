import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;

import { deployFixture } from "../utils/fixture2";
import { executeDeposit } from "../../utils/deposit";
import { setTimeout } from 'timers/promises';
import { printDeposit } from '../utils';
import { loadOracleParams } from "../../utils/exchangelive";
import { loadMarkets } from "../utils";
import markets from './markets.json';
import { formatEther } from "ethers/lib/utils";


import { createClient  } from "redis";
import { ZERO_ADDRESS } from "../../utils/constants";

const APP_INDEX=parseInt(process.env.APP_INDEX, 10);
const NETWORK = hre.network.name;
const GAS_LIMIT = 800000;

console.log("app index %s", APP_INDEX);

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const rediscon = createClient();
  rediscon.on('error', (err) => console.error('Redis sender error', err));
  await rediscon.connect();

  const { reader, dataStore, depositHandler } = fixture.contracts;

  const { depositKeepers } = fixture.accounts;
  const logKeeper = await Promise.all(depositKeepers.map(async (acc) => ({ address: acc.address, balance: formatEther(await provider.getBalance(acc.address)) })))
  console.log("Executer >> %s", JSON.stringify(logKeeper[APP_INDEX]))

  const cachedMarkets = await loadMarkets();
  console.warn("use cached market list >> %s", JSON.stringify(Object.keys(cachedMarkets), null, 2));
  const allowedMarkets = markets[NETWORK];

  console.log("use whitelist markets >> %s", JSON.stringify(allowedMarkets, null, 2));

  while (true) {
      console.log("waiting for task ....");

      const msg = await rediscon.blPop("DEPOSIT_KEEPER", 0); // Blocking
      const depositKey = msg.element;
      try{
        console.log("got a key: %s", depositKey);
        const deposit = await reader.getDeposit(dataStore.address, depositKey);
        const oracleBlock = await provider.getBlock("latest");

        await printDeposit(deposit);

        const tokenAddrs = collectTokenInfos(cachedMarkets, deposit);

        const oracleBlocks = Array(tokenAddrs.length).fill(oracleBlock, 0, tokenAddrs.length);

        const params = {
          ...await loadOracleParams(tokenAddrs),
          depositKey: depositKey,
          oracleBlocks,
          executer: depositKeepers[APP_INDEX]
        };
        await setTimeout(1400);
        const tx = await executeDeposit(fixture, params);
        console.log("deposit executed %s", tx.txReceipt.transactionHash);
      }
      catch(e){
        try{
          console.error("execute error, try to cancel: %s > %s ...", depositKey, JSON.stringify(e));
          const order = await reader.getDeposit(dataStore.address, depositKey);
          if (order[0].account == ZERO_ADDRESS) continue;
          const result = await depositHandler.connect(depositKeepers[APP_INDEX]).cancelDeposit(depositKey, {
            gasLimit: GAS_LIMIT
          });
          console.log("deposit canceled: %s -> %s", depositKey, JSON.stringify(result));
        }catch(e){
          console.error("cancel deposit error %s > ", depositKey, e);
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


function collectTokenInfos(cachedMarkets: any, deposit: any) {
  const tokenAddrs = [deposit.addresses.market]
    .concat(deposit.addresses.longTokenSwapPath)
    .concat(deposit.addresses.shortTokenSwapPath)
    .filter(marketToken => (marketToken !== undefined) && (marketToken !== ethers.constants.AddressZero))
    .flatMap(marketToken => {
      const market = cachedMarkets[marketToken];
      return market ? [market.indexToken, market.longToken, market.shortToken] : []
    })
    .concat([deposit.addresses.initialLongToken, deposit.addresses.initialShortToken])
    .filter(token => (token !== undefined) && (token !== ethers.constants.AddressZero))

  return [...new Set(tokenAddrs)];
}
