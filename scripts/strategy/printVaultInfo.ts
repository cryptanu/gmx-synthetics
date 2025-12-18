import { printStrategyVault } from "../utils";
import { deployFixture } from "../utils/fixture2";

// @todo review for new vault
async function main() {
  const fixture = await deployFixture();
  await print(fixture);
}

async function print(fixture: any) {
  const { strategyHandler } = fixture.contracts;
  const info = await strategyHandler.getVaultInfo();
  console.log(info);
  
  printStrategyVault(info)
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });