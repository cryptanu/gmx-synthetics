import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { executeWithdrawal, getWithdrawalKeys, makeWithdrawalOracleParams } from "../../utils/withdrawal";
import { printWithdrawal } from '../utils';
import { setTimeout } from 'timers/promises';
import { loadOracleParams } from "../../utils/exchangelive";
import { loadMarkets } from "../utils";
import { hashToRange } from "./utils";
import { createClient  } from "redis";
import { formatEther } from "ethers/lib/utils";
import { ZERO_ADDRESS } from "../../utils/constants";


const GAS_LIMIT = 800000;

const { ethers } = hre;
const { provider } = ethers;

const APP_INDEX=parseInt(process.env.APP_INDEX, 10);

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const rediscon = createClient();
  rediscon.on('error', (err) => console.error('Redis sender error', err));
  await rediscon.connect();

  const { withdrawKeepers } = fixture.accounts;
  const logKeeper = await Promise.all(withdrawKeepers.map(async (acc) => ({ address: acc.address, balance: formatEther(await provider.getBalance(acc.address)) })))
  console.log("Executer >> %s", JSON.stringify(logKeeper[APP_INDEX]))


  const { reader, dataStore, withdrawalHandler} = fixture.contracts;
  const cachedMarkets = await loadMarkets();
  console.warn("use cached market list >> %s", JSON.stringify(Object.keys(cachedMarkets), null, 2));

  while(true){
    console.log("waiting for task ....");

    const msg = await rediscon.blPop("WITHDRAW_KEEPER", 0); // Blocking
    const withdrawKey = msg.element;
    
    let oracleBlock = await provider.getBlock("latest");
    console.log("using block hash: " + oracleBlock.hash + ", timestamp: " + oracleBlock.timestamp + ", block#: " + oracleBlock.number)
    
    try{
        const withdraw = await reader.getWithdrawal(dataStore.address, withdrawKey);
        await printWithdrawal(withdraw);

        const tokenAddrs = collectTokenInfos(cachedMarkets, withdraw);
        const oracleBlocks = Array(tokenAddrs.length).fill(oracleBlock, 0, tokenAddrs.length);

        const params = {
          ...await loadOracleParams(tokenAddrs),
          withdrawalKey: withdrawKey,
          oracleBlocks,
          executer: withdrawKeepers[APP_INDEX]
        };
        await setTimeout(1000);
        const tx = await executeWithdrawal(fixture, params);
        console.log("withdraw executed: %s", JSON.stringify(tx.txReceipt.transactionHash));
    }catch(e){
      try {
        console.error("withdraw error > try to cancel %s > %s", withdrawKey, JSON.stringify(e));
        const order = await reader.getWithdrawal(dataStore.address, withdrawKey);
        if (order[0].account == ZERO_ADDRESS) continue;
        const result = await withdrawalHandler.connect(withdrawKeepers[APP_INDEX]).cancelWithdrawal(withdrawKey, {
            gasLimit: GAS_LIMIT
        });
        console.log("canceled withdraw: %s => tx %s", withdrawKey, result.hash);
      }
      catch(e){
          console.error("failed to cancel withdraw > %s", e);
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

function collectTokenInfos(cachedMarkets, withdraw) {
  const tokenAddrs = [withdraw.addresses.market]
    .concat(withdraw.addresses.longTokenSwapPath)
    .concat(withdraw.addresses.shortTokenSwapPath)
    .filter(marketToken => (marketToken !== undefined) && (marketToken !== ethers.constants.AddressZero))
    .flatMap(marketToken => {
      const market = cachedMarkets[marketToken];
      return market ? [market.indexToken, market.longToken, market.shortToken] : []
    })
    .filter(tokenAddr => (tokenAddr !== undefined) && (tokenAddr !== ethers.constants.AddressZero));

  return [...new Set(tokenAddrs)];
}
