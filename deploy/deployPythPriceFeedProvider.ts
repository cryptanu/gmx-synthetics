import { HardhatRuntimeEnvironment } from "hardhat/types";
import { createDeployFunction } from "../utils/deploy";
import { setBoolIfDifferent } from "../utils/dataStore";
import * as keys from "../utils/keys";
import { network } from "hardhat";

const constructorContracts = [];

const skip = async ({ gmx, network }: any) => {
  const oracleConfig = await gmx.getOracle();
  if (!oracleConfig.pythPriceFeedAddress || !oracleConfig.pythPriceFeedProviderDecimals) {
    console.log(`Skipping PythPriceFeedProvider deployment: no pyth config for network ${network.name}`);
    return true;
  }
  return false;
};

const func = createDeployFunction({
  contractName: "PythPriceFeedProvider",
  dependencyNames: constructorContracts,
  getDeployArgs: async ({ dependencyContracts, getNamedAccounts, gmx }) => {
    const { deployer } = await getNamedAccounts();
    const oracleConfig = await gmx.getOracle();
    return [deployer, oracleConfig.pythPriceFeedProviderDecimals, oracleConfig.pythPriceFeedAddress];
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

      const { deployer } = await getNamedAccounts();

      const priceFeedOnChain = await deployments.read("PythPriceFeedProvider", "priceFeedIds", address);
      if (priceFeedOnChain !== pythPriceFeed.pythPriceFeedId) {
        console.log("executing setPriceFeedId to Pyth price feed for ", tokenSymbol);
        await deployments.execute(
          "PythPriceFeedProvider",
          { from: deployer, log: true },
          "setPriceFeedId",
          address,
          pythPriceFeed.pythPriceFeedId
        );
      } else {
        console.log("Pyth price feed already set for", tokenSymbol);
      }
    }
  },
});
func.skip = skip;
func.tags = ["PythPriceFeedProvider"];
export default func;
