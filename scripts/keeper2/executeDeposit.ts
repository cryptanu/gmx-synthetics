import hre from "hardhat";
const { ethers } = hre;
import * as keys from "../../utils/keys";

const ORACLE_API_URL = "https://oracle-mainnet.bean.exchange/v1/oracle-params";

/**
 * Fetch oracle params from API for deposit execution
 */
async function fetchOracleParams(owner: string, market: string) {
  console.log("Fetching oracle params from:", ORACLE_API_URL);
  console.log("Request body:", { owner, market });

  const response = await fetch(ORACLE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ owner, market }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch oracle params: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

async function main() {
  const dataStore = await ethers.getContract("DataStore");
  const depositHandler = await ethers.getContract("DepositHandler");
  const reader = await ethers.getContract("Reader");

  const [wallet] = await ethers.getSigners();
  console.log("Executor wallet:", wallet.address);

  const depositCount = await dataStore.getBytes32Count(keys.DEPOSIT_LIST);
  console.log("Pending deposits count:", depositCount.toString());
  if (depositCount.eq(0)) {
    console.log("No pending deposits to execute");
    return;
  }
  const depositKeys = await dataStore.getBytes32ValuesAt(keys.DEPOSIT_LIST, 0, 1);
  const depositKey = depositKeys[0];
  console.log("Using first pending deposit key:", depositKey);

  const deposit = await reader.getDeposit(dataStore.address, depositKey);
  if (deposit.addresses.account === ethers.constants.AddressZero) {
    console.log("Deposit not found or already executed:", depositKey);
    return;
  }

  console.log("\n=== Deposit Details ===");
  console.log("Account:", deposit.addresses.account);
  console.log("Receiver:", deposit.addresses.receiver);
  console.log("Market:", deposit.addresses.market);
  console.log("Initial Long Token:", deposit.addresses.initialLongToken);
  console.log("Initial Short Token:", deposit.addresses.initialShortToken);
  console.log("Long Token Amount:", deposit.numbers.initialLongTokenAmount.toString());
  console.log("Short Token Amount:", deposit.numbers.initialShortTokenAmount.toString());
  console.log("Execution Fee:", deposit.numbers.executionFee.toString());
  console.log("Updated At Block:", deposit.numbers.updatedAtBlock.toString());
  console.log("Updated At Time:", deposit.numbers.updatedAtTime.toString());

  // Check expiration
  const requestExpirationTime = await dataStore.getUint(keys.REQUEST_EXPIRATION_TIME);
  const currentBlock = await ethers.provider.getBlock("latest");
  const expirationTime = deposit.numbers.updatedAtTime.add(requestExpirationTime);
  const isExpired = currentBlock.timestamp > expirationTime.toNumber();

  console.log("\n=== Expiration Check ===");
  console.log("Request Expiration Time:", requestExpirationTime.toString(), "seconds");
  console.log("Deposit Created At:", new Date(deposit.numbers.updatedAtTime.toNumber() * 1000).toISOString());
  console.log("Expires At:", new Date(expirationTime.toNumber() * 1000).toISOString());
  console.log("Current Time:", new Date(currentBlock.timestamp * 1000).toISOString());
  console.log("Is Expired:", isExpired ? "❌ YES" : "✓ NO");

  if (isExpired) {
    const expiredFor = currentBlock.timestamp - expirationTime.toNumber();
    console.log(`\n❌ Deposit has EXPIRED ${expiredFor} seconds ago!`);
    console.log("Cancelling expired deposit...");
    try {
      const gasLimit = 1000000; // 1M gas
      const tx = await depositHandler.cancelDeposit(depositKey, { gasLimit });

      console.log("Cancel tx sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    } catch (cancelError: any) {
      console.error("Failed to cancel deposit:", cancelError.reason || cancelError.message);
      if (cancelError.receipt) {
        console.error("Receipt status:", cancelError.receipt.status);
      }
    }
    return;
  }

  // Fetch oracle params from API
  console.log("\n=== Fetching Oracle Params ===");
  const oracleParams = await fetchOracleParams(deposit.addresses.account, deposit.addresses.market);

  console.log("\n=== Executing Deposit ===");

  try {
    console.log("Sending transaction...");
    const tx = await depositHandler.executeDeposit(depositKey, oracleParams);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  } catch (error: any) {
    console.error("\n=== Execution Failed ===");
    console.error("Error:", error.reason || error.message);
    const errorData = error.data || error.error?.data;
    if (errorData && errorData !== "0x") {
      console.error("Raw error data:", typeof errorData === "string" ? errorData.slice(0, 200) : errorData);
    }
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
