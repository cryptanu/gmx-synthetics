import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { loadOracleParams } from "../../utils/exchangelive";
import { forceAdl } from "../../utils/adl";
import { printMarket, printPosition } from '../utils';
import { TOKEN_ORACLE_TYPES } from "../../utils/oracle";
import { formatUnits } from "ethers/lib/utils";

const { ethers } = hre;

async function main() {
  const fixture = await deployFixture();
  await startKeeper(fixture);
}

const step = 100;
async function startKeeper(fixture: any) {
  const { reader, dataStore } = fixture.contracts;
  const tir = 0;
  const { user0, user1, user2, user3, user4, user5, user6 } = fixture.accounts;

  const users = [user0, user1, user2, user3, user4, user5, user6];
  console.log("------------------------ Scanning ADL ------------------------");
  try {
    // const markets = [...(await reader.getMarkets(dataStore.address, 0, 100))];
    const markets = [
      // {
      //   "name": "WETH_USDC_USDC",
      //   "marketToken": "0x04a0fd88B6f6f4eDaE7befEa50BaC38cDb81C37f",
      //   "indexToken": "0x4F1471A645D3734653c3bfA2518FE790ec330216",
      //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
      //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
      // },
      // {
      //   "name": "WBTC_USDC_USDC",
      //   "marketToken": "0xa78bD6F9a1b52218172F039103c62E42A22b8A95",
      //   "indexToken": "0x5E380FA40A7c57c3b0fcdf7884d84b704eea854b",
      //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
      //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
      // },
      // {
      //   "name": "WMONAD_USDC_USDC",
      //   "marketToken": "0xc48Df37f466Bc3FEDF706541E91C1E43B71D9b96",
      //   "indexToken": "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
      //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
      //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
      // },
      // {
      //   "name": "SOL_USDC_USDC",
      //   "marketToken": "0x04A46041F20104923037d5bB3945Fe5E64e01598",
      //   "indexToken": "0xAaCEc858D0EC661516C7A5B8cb8591276C3b6300",
      //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
      //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
      // },
      {
      "name": "WMONAD_WMONAD_USDC",
      "marketToken": "0x7efAF9b4F2eC67EB0BAf737854C2232B6851BBa9",
      "indexToken": "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
      "longToken": "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
      "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
      }
    ]

    for await (const market of markets) {
      if (market.indexToken === undefined || market.indexToken === ethers.constants.AddressZero) {
        continue;
      }
      try {
        console.warn("force adl long side for market >>");
        printMarket(market);
        const groupedPositions = await collectMarketPositions(reader, dataStore, market.marketToken, tir);
        for (const position of groupedPositions) {
          try {
            const sizeInUsd = +formatUnits(position.numbers.sizeInUsd, 30);
            // if (sizeInUsd < 100) {
            //   // console.warn("skip this position, collateralAmount < 1");
            //   continue;
            // }
            printPosition(position);
            const accountAdlParam = {
              account: position.addresses.account,
              market: market,
              collateralToken: { address: position.addresses.collateralToken },
              isLong: position.flags.isLong,
              ...await loadOracleParams([market.indexToken, position.addresses.collateralToken]),
              exec: users[tir]
            };
            fillTokenOracleTypes(accountAdlParam);

            console.log("force adl param >>");

            const tx = await forceAdl(fixture, accountAdlParam);
            console.warn("adl success with hash >> %s ...done!", JSON.stringify(tx.transactionHash));
            // sleep 2s
            // await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          catch (e) {
            console.error("adl position long side got error >", e);
          }
        }
      } catch (e) {
        console.error("adl market long side error>", e);
      }
    }
  } catch (error) {
    console.error("Get markets error %s", error);
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

async function collectMarketPositions(reader, dataStore, marketAddr, tir) {
  const poCount = await reader.getMarketPositionCount(dataStore.address, marketAddr)
  const from = tir * step;
  const to = from + step;
  console.log("=========================");
  console.log(poCount.toString(), "positions found for market", marketAddr);
  console.log("from", from, "to", to);

  return reader.getMarketPositions(dataStore.address, marketAddr, from, to);
  // return reader.getAccountPositions(dataStore.address, "0xCC4164e06d133316B67aCC0F12aBf676Bf7a18E6", 0, 10);
}

function fillTokenOracleTypes(adlParams: any) {
  adlParams.tokenOracleTypes = [];
  for (let index = 0; index < adlParams.tokens.length; index++) {
    adlParams.tokenOracleTypes.push(TOKEN_ORACLE_TYPES.DEFAULT);
  }
}