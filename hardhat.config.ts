import dotenv from "dotenv";
dotenv.config();

import path from "path";
import fs from "fs";
import { ethers } from "ethers";

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "hardhat-deploy";

import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";

// extends hre with gmx domain data
import "./config";

// add test helper methods
import "./utils/test";

const getRpcUrl = (network) => {
  const defaultRpcs = {
    monad: "https://rpc.monad.xyz",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    arbitrumGoerli: "https://goerli-rollup.arbitrum.io/rpc"
  };

  let rpc = defaultRpcs[network];

  const filepath = path.join("./.rpcs.json");
  if (fs.existsSync(filepath)) {
    const data = JSON.parse(fs.readFileSync(filepath).toString());
    if (data[network]) {
      rpc = data[network];
    }
  }

  return rpc;
};

const getEnvAccounts = (chainName?: string) => {
  const { ACCOUNT_KEY, ACCOUNT_KEY_FILE } = process.env;

  if (ACCOUNT_KEY) {
    return [ACCOUNT_KEY];
  }

  if (ACCOUNT_KEY_FILE) {
    const filepath = path.join("./keys/", ACCOUNT_KEY_FILE);
    const data = JSON.parse(fs.readFileSync(filepath));
    if (!data) {
      throw new Error("Invalid key file");
    }

    if (data.key) {
      return [data.key];
    }

    if (!data.mnemonic) {
      throw new Error("Invalid mnemonic");
    }

    const wallet = ethers.Wallet.fromMnemonic(data.mnemonic);
    return [wallet.privateKey];
  }

  return [];
};

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10,
        details: {
          constantOptimizer: true,
        },
      },
    },
  },
  networks: {
    hardhat: {
      saveDeployments: true,
      // forking: {
      //   url: `https://rpc.ankr.com/avalanche`,
      //   blockNumber: 33963320,
      // },
    },
    localhost: {
      saveDeployments: true,
    },
    monad: {
      //@todo
      url: getRpcUrl("monad"),
      chainId: 143,
      accounts: getEnvAccounts(),
      verify: {
        etherscan: {
          apiUrl: "https://api.arbiscan.io/",
          apiKey: process.env.ARBISCAN_API_KEY,
        },
      },
      blockGasLimit: 20_000_000,
    },

    arbitrum: {
      url: getRpcUrl("arbitrum"),
      chainId: 42161,
      accounts: getEnvAccounts(),
      verify: {
        etherscan: {
          apiUrl: "https://api.arbiscan.io/",
          apiKey: process.env.ARBISCAN_API_KEY,
        },
      },
      blockGasLimit: 20_000_000,
    },
    arbitrumGoerli: {
      url: getRpcUrl("arbitrumGoerli"),
      chainId: 421613,
      accounts: getEnvAccounts(),
      verify: {
        etherscan: {
          apiUrl: "https://api-goerli.arbiscan.io/",
          apiKey: process.env.ARBISCAN_API_KEY,
        },
      },
      blockGasLimit: 10000000,
    }
  },
  // hardhat-deploy has issues with some contracts
  // https://github.com/wighawag/hardhat-deploy/issues/264
  etherscan: {
    apiKey: {
      monad: process.env.MONADVISION_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      arbitrumGoerli: process.env.ARBISCAN_API_KEY,
    },
    customChains: [],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
