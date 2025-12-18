/**
 * Print out all deposits
 */
import hre from "hardhat";
import {expandDecimals } from "../../utils/math";
import { getPoolAmount } from "../../utils/market";
import { getBalanceOf } from "../../utils/token";
import { deployFixture } from "../utils/fixture2";
import {getDepositKeys } from "../../utils/deposit";
import { printDeposit} from '../utils'

async function main() {
  const fixture = await deployFixture();
  let reader, dataStore
  ({reader, dataStore} = fixture.contracts);

  console.log("All deposits ....");
  const depositKeys = await getDepositKeys(dataStore, 0, 100);
  for await (const depositKey of depositKeys){
    try{
      const deposit = await reader.getDeposit(dataStore.address, depositKey);
      await printDeposit(deposit);
    }
    catch(e){
      console.error("execute got error: %s --> %s", depositKey, e);
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