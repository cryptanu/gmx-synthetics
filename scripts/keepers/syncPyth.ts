 import hre from "hardhat";
 import { deployFixture } from "../utils/fixture2";
 import { setTimeout } from 'timers/promises';
 import {loadPythSigs } from "../../utils/priceslive";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";

const PYTH_HERMES_BASE_URL = "https://hermes.pyth.network";

 const { ethers } = hre;

 const GAS_LIMIT = 400000;

 async function main() {
   const fixture = await deployFixture();
   await runKeeper(fixture);
 }

 async function runKeeper(fixture: any) {
    let btcPythPriceFeed: any, solPriceFeed: any, usdcPriceFeed: any;
    ({btcPythPriceFeed, solPriceFeed, usdcPriceFeed} = fixture.contracts);

    let counter = 0;
    while (true) {
      await setTimeout(3000);
      console.log("--------- sync pyth ------------");
      try {
          console.log("loading pythsigs ...");
          const pythsigs = await loadPythSigs();
          console.log("submit pyth data ...")
          let result;
          if(counter > 0){
            result = await solPriceFeed.syncFromPyth(pythsigs, {
              gasLimit: GAS_LIMIT,
              value: parseEther("0.000001") //@dev give some ether at the first time 
            });
          }
          else{
            result = await solPriceFeed.syncFromPyth(pythsigs, {
              gasLimit: GAS_LIMIT,
              // value: parseEther("0.000001") //@dev dont provide ether after that 
            });
          }
          counter++;
          console.log("tx result: %s", result);
          
          //then try to read the price
          let btcPrices = await btcPythPriceFeed.latestRoundData();
          let solPrices = await solPriceFeed.latestRoundData();
          // let usdcPrices = await usdcPriceFeed.latestRoundData();
          
          console.log("btc price >> price %s > publish time %s", btcPrices[1].toNumber(), btcPrices[3].toNumber());
          console.log("sol price >> price %s > publish time %s", solPrices[1].toNumber(), solPrices[3].toNumber());
          // console.log("usdc price >> price %s > publish time %s", usdcPrices[1].toNumber(), usdcPrices[3].toNumber());

        } catch (error) {
          console.error("feed price got error %s", error);
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