import hre from "hardhat";
const { ethers } = hre;

import { setTimeout } from 'timers/promises';
import { loadMarkets } from "../utils";
import { deployFixture } from "../utils/fixture2";
import markets from './markets.json';


import { createClient } from "redis";
import { getWithdrawalKeys } from "../../utils/withdrawal";

const NETWORK = hre.network.name;

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const rediscon = createClient();
  rediscon.on('error', (err) => console.error('Redis sender error', err));
  await rediscon.connect();

  const { dataStore } = fixture.contracts;
  const cachedMarkets = await loadMarkets();
  console.warn("use cached market list >> %s", JSON.stringify(Object.keys(cachedMarkets), null, 2));
  const allowedMarkets = markets[NETWORK];

  console.log("use whitelist markets >> %s", JSON.stringify(allowedMarkets, null, 2));

  while (true) {
    await setTimeout(1200);
    try {
      console.log(">>scan all withdraw...");
      const withdrawalKeys = await getWithdrawalKeys(dataStore, 0, 20);
      for (let index = 0; index < withdrawalKeys.length; index++) {
        const withdrawalKey = withdrawalKeys[index];
        const exists = await rediscon.exists(withdrawalKey);
        if(exists === 0)
          {
            await rediscon.lPush("WITHDRAW_KEEPER", withdrawalKey);
            rediscon.set(withdrawalKey, "true", {EX: 60*2});
            console.log("pushed withdraw %s", withdrawalKey);
          }
          else{
            console.log("ignore forwared withdraw: %s", withdrawalKey);
          }
      }
    } catch (error) {
      console.error("load withdraw error %s", error);
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
