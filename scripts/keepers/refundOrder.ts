import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { getOrderKeys} from "../../utils/order";
import { setTimeout } from 'timers/promises';

const { ethers } = hre;

const GAS_LIMIT = 800000;

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const {dataStore, orderHandler } = fixture.contracts;
    console.log("----- scanning order cancel-----");
    try {

      const orderKeys =[
        "0xd294cee7263e215d3fdd5a5aa6a8dcf800bbd84b76c73978c94fb97de4c0e760",
        "0x7d04eed4c0cf8e49ba8607bbe98223ff27100fc07c5452552152b832385c7f6d",
        "0xf45667a39a4fffa96d859e25e1d98ec769f49d54f6c83ab9a31c7cb83d39d95e",
        "0x0cab5ffb59cc89e2e007ffd706599069fb0e38de8801f3f72df1bab9c416980b",
        "0xb242e5a2b48df837c100f97df003cf8a0dedf78964ecace93eb2e89feda22acb",
        "0x74a56e84c89569e640b833971ceb2d3d1aab12f87643d6f2a6f1373408f5d41e",
        "0x9f47aa223022e1f2d3a8a130e1f2994e7d6ce54b9e4ef6cbb0c313ec118574b9",
      ]  

      for (const orderKey of orderKeys) {
        try {
          await setTimeout(200);
          const result = await orderHandler.cancelOrder(orderKey, {
            gasLimit: GAS_LIMIT
          });
          console.log("canceled order: %s -> %s", orderKey, JSON.stringify(result));
        }
        catch (e) {
          console.error("cancel order error: %s --> %s", orderKey, e);
        }
      }
    } catch (error) {
      console.error("Get orders keys error %s", error);
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
