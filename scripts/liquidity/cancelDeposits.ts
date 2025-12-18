/**
 * @todo review 
 * cancel deposits
 * - when deposit is outdated
 * - or user want to ...
 */
import hre from "hardhat";

import { getMarketTokenAddress, DEFAULT_MARKET_TYPE } from "../../utils/market";
import { WNT, } from "../../typechain-types";
import {getDepositKeys } from "../../utils/deposit";
const { ethers } = hre;

async function main() {
  const dataStore = await ethers.getContract("DataStore");
  const reader = await ethers.getContract("Reader");
  const depositHandler = await ethers.getContract("DepositHandler");
  const marketFactory = await ethers.getContract("MarketFactory");
  const roleStore = await ethers.getContract("RoleStore");

  //@todo update market token here
  const indexToken = await ethers.getContract("SOL");
  const longToken = await ethers.getContract("SOL");
  const shortToken = await ethers.getContract("USDC");

  const marketAddress = await getMarketTokenAddress(
    indexToken.address,
    longToken.address,
    shortToken.address,
    DEFAULT_MARKET_TYPE,
    marketFactory.address,
    roleStore.address,
    dataStore.address
  );

  console.log("run cancelDeposit of market %s ...", marketAddress);

  //execute all request
  const depositKeys = await getDepositKeys(dataStore, 0, 100);
  
  for (let index = 0; index < depositKeys.length; index++) {
      try{
        const depositKey = depositKeys[index];
        // const deposit = await reader.getDeposit(dataStore.address, depositKey);
        console.log("canceling deposit key %s", depositKey);

        const tx = await depositHandler.cancelDeposit(depositKey, {
          gasLimit: 29000000,
          gasPrice: 100,
        });
        await tx.wait();
        console.log("transaction sent", tx.hash);
      }
      catch(e){
        console.error("Failed to execute deposit -> %s", e);
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