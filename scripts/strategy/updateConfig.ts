import { parseEther } from "ethers/lib/utils";
import { deployFixture } from "../utils/fixture2";

// @todo review for new vault
async function main() {
  const fixture = await deployFixture();
  await config(fixture);
}

async function config(fixture: any) {
  const { strategyHandler } = fixture.contracts;
  const configT = await strategyHandler.params();
  console.log('current: %s', configT);
  const updateTx = await strategyHandler.config(0, 25000, 5, 90000, "0x268E4E24E0051EC27b3D27A95977E71cE6875a05", 0);
  await updateTx.wait();
  const newConfig = await strategyHandler.params();
  console.log('updated to: %s', newConfig);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });