import hre from "hardhat";
import { promises as fsPromises } from "fs";
import contracts0 from "../../bean-interface/src/config/contracts.json";
import uiTokens0 from "../../bean-interface/src/config/tokens.json";
import apiTokens0Linea from "../../bean-api/config/tokens.json";

//@todo review
const FILE_TOKENS_UI = "../../bean-interface/src/config/tokens.json";
const FILE_CONTRACTS_UI = "../../bean-interface/src/config/contracts.json";

const tokensMap = {
  lineaGoerli: apiTokens0Linea,
};

const tokenFileMap = {
  lineaGoerli: "../../bean-api/config/tokens.json",
};

async function main() {
  const { deployments } = hre;
  const NETWORK = hre.network.name;
  const apiTokens0 = tokensMap[NETWORK];
  const FILE_TOKENS_API = tokenFileMap[NETWORK];

  const allDeployments = await deployments.all();

  /**
   * @todo:
   * - contract info format  for UI
   * - API token address format for API
   */
  const tokensNet = {};
  const contractsNet = {};

  for (const [contractName, { address }] of Object.entries(allDeployments)) {
    {
      //contract info
      if (contractName === "WMON") contractsNet["WMON"] = address;
      if (contractName === "WETH") contractsNet["WETH"] = address;
      if (contractName === "DataStore") contractsNet["DataStore"] = address;
      if (contractName === "EventEmitter") contractsNet["EventEmitter"] = address;
      if (contractName === "ExchangeRouter") contractsNet["ExchangeRouter"] = address;
      if (contractName === "DepositVault") contractsNet["DepositVault"] = address;
      if (contractName === "WithdrawalVault") contractsNet["WithdrawalVault"] = address;
      if (contractName === "OrderVault") contractsNet["OrderVault"] = address;
      if (contractName === "Reader") contractsNet["Reader"] = address;
      if (contractName === "Router") contractsNet["Router"] = address;
      if (contractName === "Timelock") contractsNet["Timelock"] = address;
      if (contractName === "Multicall3") contractsNet["Multicall3"] = address;
      if (contractName === "ReferralStorage") contractsNet["ReferralStorage"] = address;
      if (contractName === "ReferralReader") contractsNet["ReferralReader"] = address;
    }

    {
      //API's tokens list
      if (contractName === "WMON") {
        tokensNet["WMON"] = address;
      }
      if (contractName === "WETH") {
        tokensNet["WETH"] = address;
      }
      if (contractName === "WBTC") {
        tokensNet["WBTC"] = address;
      }
      if (contractName === "USDC") {
        tokensNet["USDC"] = address;
      }
      if (contractName === "SOL") {
        tokensNet["SOL"] = address;
      }
      if (contractName === "DOGE") {
        tokensNet["DOGE"] = address;
      }
      if (contractName === "PEPE") {
        tokensNet["PEPE"] = address;
      }
    }

    {
      //API's simulate tokens list
      if (contractName === "S_WBTC") {
        tokensNet["S_WBTC"] = address;
      }
      if (contractName === "S_USDT") {
        tokensNet["S_USDT"] = address;
      }
      if (contractName === "S_USDC") {
        tokensNet["S_USDC"] = address;
      }
      if (contractName === "S_SOL") {
        tokensNet["S_SOL"] = address;
      }
      if (contractName === "S_DOGE") {
        tokensNet["S_DOGE"] = address;
      }
    }
  }

  apiTokens0[NETWORK] = tokensNet;
  uiTokens0[NETWORK] = tokensNet;
  contracts0[NETWORK] = contractsNet;

  console.log("tokens %s", JSON.stringify(tokensNet, null, 2));
  console.log("contracts %s", JSON.stringify(contractsNet, null, 2));

  console.log("Dumping to file > %s", FILE_TOKENS_API);
  await fsPromises.writeFile(FILE_TOKENS_API, JSON.stringify(apiTokens0, null, 2));

  console.log("Dumping to file > %s", FILE_TOKENS_UI);
  await fsPromises.writeFile(FILE_TOKENS_UI, JSON.stringify(uiTokens0, null, 2));

  console.log("Dumping to file > %s", FILE_CONTRACTS_UI);
  await fsPromises.writeFile(FILE_CONTRACTS_UI, JSON.stringify(contracts0, null, 2));

  console.log("All done!!!");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
