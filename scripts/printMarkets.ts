import hre from "hardhat";
import * as keys from "../utils/keys";
import { promises as fsPromises } from 'fs';
import MARKET from './keepers/markets.json';
import MARKET_STATE from '../config/marketstate.json';

const FILE_MARKETS = "./keepers/markets.json";
const FILE_MARKET_STATE = "../config/marketstate.json";

//@todo review
async function main() {
  const networkName = hre.network.name;
  const tokens = await hre.gmx.getTokens();
  const addressToSymbol: { [address: string]: string } = {};
  for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
    let address = tokenConfig.address;
    if (!address) {
      address = (await hre.ethers.getContract(tokenSymbol)).address;
    }
    addressToSymbol[address] = tokenSymbol;
  }

  const reader = await hre.ethers.getContract("Reader");
  const dataStore = await hre.ethers.getContract("DataStore");
  
  const deployedMarkets = [...(await reader.getMarkets(dataStore.address, 0, 100))];
  deployedMarkets.sort((a, b) => a.indexToken.localeCompare(b.indexToken));

  const netMarkets = {};
  const netMarketsState = [];

  for (const deployedMarket of deployedMarkets) {
    const isDisabled = await dataStore.getBool(keys.isMarketDisabledKey(deployedMarket.marketToken));
    const indexTokenSymbol = addressToSymbol[deployedMarket.indexToken];
    const longTokenSymbol = addressToSymbol[deployedMarket.longToken];
    const shortTokenSymbol = addressToSymbol[deployedMarket.shortToken];
    const marketName = (indexTokenSymbol ? indexTokenSymbol : "SWAP") + "_" + longTokenSymbol + "_" + shortTokenSymbol;
    console.log(
      "%s index: %s long: %s short: %s is disabled: %s",
      deployedMarket.marketToken,
      indexTokenSymbol?.padEnd(5) || "(swap only)",
      longTokenSymbol?.padEnd(5),
      shortTokenSymbol?.padEnd(5),
      isDisabled
    );

    netMarkets[deployedMarket.marketToken] = {
      name: marketName,
      address: deployedMarket.marketToken,
      indexToken: deployedMarket.indexToken,
      longToken: deployedMarket.longToken,
      shortToken: deployedMarket.shortToken
    };

    netMarketsState.push({
      address: deployedMarket.marketToken,
      name: marketName,
      isDisabled: isDisabled
    })
  }

  MARKET[networkName] = netMarkets;
  MARKET_STATE[networkName] = netMarketsState;

  await fsPromises.writeFile(FILE_MARKETS, JSON.stringify(MARKET,  null, 2));
  console.log("dumping market info to files --> %s ... DONE!", FILE_MARKETS);

  await fsPromises.writeFile(FILE_MARKET_STATE, JSON.stringify(MARKET_STATE,  null, 2));
  console.log("dumping market state info to files --> %s ... DONE!", FILE_MARKET_STATE);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
