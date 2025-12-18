import {deployFixture } from "../utils/fixture2";
import {printOrder} from '../utils'
import { getPositionCount } from "../../utils/position";

async function main() {
  const fixture = await deployFixture();
  await printOrders(fixture);
}

async function printOrders(fixture:any) {
  const {reader, dataStore} = fixture.contracts;
  console.log("------------------------ Listing all Orders ------------------------");
  const userPositions = await reader.getAccountPositions(dataStore.address, "0xCC4164e06d133316B67aCC0F12aBf676Bf7a18E6", 0, 5);
  console.log(userPositions);
  
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });