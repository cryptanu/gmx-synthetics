import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;

import { deployFixture } from "../utils/fixture";
import { getDepositCount, getDepositKeys, executeDeposit } from "../utils/deposit";
import { printDeposit, loadMarkets } from "./utils";
import { loadOracleParams } from "../utils/exchangelive";
import { ZERO_ADDRESS } from "../utils/constants";

const GAS_LIMIT = 800000;

async function main() {
  const fixture = await deployFixture();

  // Get deposit key from command line args or execute the first pending deposit
  const depositKeyArg = process.env.DEPOSIT_KEY;

  if (depositKeyArg) {
    console.log("Executing specific deposit: %s", depositKeyArg);
    await executeSpecificDeposit(fixture, depositKeyArg);
  } else {
    console.log("No DEPOSIT_KEY provided, executing first pending deposit...");
    await executeFirstPendingDeposit(fixture);
  }
}

async function executeSpecificDeposit(fixture: any, depositKey: string) {
  const { reader, dataStore, depositHandler } = fixture.contracts;
  const { depositKeepers } = fixture.accounts;
  const cachedMarkets = await loadMarkets();

  try {
    const deposit = await reader.getDeposit(dataStore.address, depositKey);

    if (deposit.addresses.account === ZERO_ADDRESS) {
      console.log("Deposit not found or already executed: %s", depositKey);
      return;
    }

    console.log("\n=== Deposit Details ===");
    await printDeposit(deposit);

    const oracleBlock = await provider.getBlock("latest");
    console.log("\nUsing block: #%s, hash: %s, timestamp: %s",
      oracleBlock.number,
      oracleBlock.hash,
      oracleBlock.timestamp
    );

    const tokenAddrs = collectTokenInfos(cachedMarkets, deposit);
    console.log("\nTokens for oracle params: %s", JSON.stringify(tokenAddrs, null, 2));

    const oracleBlocks = Array(tokenAddrs.length).fill(oracleBlock, 0, tokenAddrs.length);

    const params = {
      ...await loadOracleParams(tokenAddrs),
      depositKey: depositKey,
      oracleBlocks,
      executer: depositKeepers[0]
    };

    console.log("\nExecuting deposit...");
    const tx = await executeDeposit(fixture, params);
    console.log("\nDeposit executed successfully!");
    console.log("Transaction hash: %s", tx.txReceipt.transactionHash);
  } catch (e) {
    console.error("\nExecution failed:", e);

    // Attempt to cancel on failure
    try {
      console.log("\nAttempting to cancel deposit...");
      const result = await depositHandler.connect(depositKeepers[0]).cancelDeposit(depositKey, {
        gasLimit: GAS_LIMIT
      });
      console.log("Deposit canceled. Tx hash: %s", result.hash);
    } catch (cancelError) {
      console.error("Cancel deposit failed:", cancelError);
    }
  }
}

async function executeFirstPendingDeposit(fixture: any) {
  const { dataStore } = fixture.contracts;

  const depositCount = await getDepositCount(dataStore);
  console.log("Total pending deposits: %s", depositCount.toString());

  if (depositCount.eq(0)) {
    console.log("No pending deposits to execute.");
    return;
  }

  const depositKeys = await getDepositKeys(dataStore, 0, 1);
  const depositKey = depositKeys[0];
  console.log("First pending deposit key: %s", depositKey);

  await executeSpecificDeposit(fixture, depositKey);
}

function collectTokenInfos(cachedMarkets: any, deposit: any) {
  const tokenAddrs = [deposit.addresses.market]
    .concat(deposit.addresses.longTokenSwapPath)
    .concat(deposit.addresses.shortTokenSwapPath)
    .filter(marketToken => (marketToken !== undefined) && (marketToken !== ethers.constants.AddressZero))
    .flatMap(marketToken => {
      const market = cachedMarkets[marketToken];
      return market ? [market.indexToken, market.longToken, market.shortToken] : []
    })
    .concat([deposit.addresses.initialLongToken, deposit.addresses.initialShortToken])
    .filter(token => (token !== undefined) && (token !== ethers.constants.AddressZero))

  return [...new Set(tokenAddrs)];
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
