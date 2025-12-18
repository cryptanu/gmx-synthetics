import { HardhatRuntimeEnvironment } from "hardhat/types";
import { createDeployFunction } from "../utils/deploy";
import {
  setAddressIfDifferent,
  setBoolIfDifferent,
  setBytes32IfDifferent,
  setUintIfDifferent,
} from "../utils/dataStore";
import * as keys from "../utils/keys";
import { network } from "hardhat";

const constructorContracts = ["DataStore"];

const skip = async ({ gmx, network }: any) => {
  const oracleConfig = await gmx.getOracle();
  if (!oracleConfig.pythPriceFeedAddress || !oracleConfig.pythPriceFeedAgeTimestamp) {
    console.log(`Skipping PythPriceFeedProvider deployment: no pyth config for network ${network.name}`);
    return true;
  }
  return false;
};

const func = createDeployFunction({
  contractName: "PythPriceFeedProvider",
  dependencyNames: constructorContracts,
  getDeployArgs: async ({ dependencyContracts }) => {
    return constructorContracts.map((dependencyName) => dependencyContracts[dependencyName].address);
  },
  afterDeploy: async ({ deployedContract, gmx, getNamedAccounts, deployments }) => {
    await setBoolIfDifferent(
      keys.isOracleProviderEnabledKey(deployedContract.address),
      true,
      "isOracleProviderEnabledKey"
    );

    const oracleConfig = await gmx.getOracle();
    if (!oracleConfig.pythPriceFeedAddress) {
      console.log("Skipping PythPriceFeedProvider deployment: no pyth price feed address for network", network.name);
      return;
    } else {
      await setAddressIfDifferent(
        keys.PYTH_PRICE_FEED_ADDRESS,
        oracleConfig.pythPriceFeedAddress,
        "PYTH_PRICE_FEED_ADDRESS"
      );

      await setUintIfDifferent(
        keys.PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP,
        oracleConfig.pythPriceFeedAgeTimestamp,
        "PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP"
      );

      if (oracleConfig.pythPriceFeedProvderIsAtomic) {
        await setBoolIfDifferent(
          keys.isAtomicOracleProviderKey(deployedContract.address),
          true,
          "isAtomicOracleProviderKey"
        );
      }
    }
    for (const [tokenSymbol, tokenObj] of Object.entries(
      oracleConfig.tokens as Record<string, { pythPriceFeed: { pythPriceFeedId: string } }>
    )) {
      const tokens = await gmx.getTokens();
      if (!tokens[tokenSymbol]) {
        console.log("Skipping PythPriceFeedProvider deployment: no token for", tokenSymbol);
        continue;
      }

      const token = tokens[tokenSymbol];
      const address = token.address;
      const { pythPriceFeed } = tokenObj;
      if (!pythPriceFeed) {
        console.log("Skipping PythPriceFeedProvider deployment: no pyth price feed for", tokenSymbol);
        continue;
      }

      await setBytes32IfDifferent(
        keys.pythPriceFeedIdKey(address),
        pythPriceFeed.pythPriceFeedId,
        "PYTH_PRICE_FEED_ID"
      );
    }
  },
});
func.skip = skip;
func.tags = ["PythPriceFeedProvider"];
export default func;
