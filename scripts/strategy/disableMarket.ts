import { deployFixture } from "../utils/fixture2";
import markets from '../keepers/markets.json';

const NETWORK = hre.network.name;

// @todo review for new vault
async function main() {
  const fixture = await deployFixture();
  await config(fixture);
}

async function config(fixture: any) {
  const { strategyHandler } = fixture.contracts;
  const marketEnable = Object.keys(markets[NETWORK]);
  await strategyHandler.enableMarkets(marketEnable, [...Array(marketEnable.length)].map(x => false));
  console.log(`Disable success ${marketEnable.length} markets to strategy!!!`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });