import hre from "hardhat";
import { deployFixture} from "../utils/fixture2";
import { setTimeout } from 'timers/promises';
import { getDepositKeys } from "../../utils/deposit";

const { ethers } = hre;

const GAS_LIMIT = 800000;

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const {dataStore, depositHandler } = fixture.contracts;

    console.log("----- scanning order cancel-----");
    try {
//       0xb242e5a2b48df837c100f97df003cf8a0dedf78964ecace93eb2e89feda22acb
// 12|masterOrder  | ignore forwared order: 0x74a56e84c89569e640b833971ceb2d3d1aab12f87643d6f2a6f1373408f5d41e
// 12|masterOrder  | ignore forwared order: 0x9f47aa223022e1f2d3a8a130e1f2994e7d6ce54b9e4ef6cbb0c313ec118574b9
      const orderKeys = [
        "0xb242e5a2b48df837c100f97df003cf8a0dedf78964ecace93eb2e89feda22acb",
        "0x74a56e84c89569e640b833971ceb2d3d1aab12f87643d6f2a6f1373408f5d41e",
        "0x9f47aa223022e1f2d3a8a130e1f2994e7d6ce54b9e4ef6cbb0c313ec118574b9",
      ]

      for (const depositKey of orderKeys) {
        try {
          await setTimeout(200);
          const result = await depositHandler.cancelDeposit(depositKey, {
            gasLimit: GAS_LIMIT
          });
          console.log("canceled deposit: %s -> %s", depositKey, JSON.stringify(result));
        }
        catch (e) {
          console.error("cancel deposit error: %s --> %s", depositKey, e);
        }
      }
    } catch (error) {
      console.error("Get deposit keys error %s", error);
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
