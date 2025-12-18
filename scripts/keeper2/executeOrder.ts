import hre from "hardhat";
const { ethers } = hre;
import * as keys from "../../utils/keys";

const ORACLE_API_URL = "https://oracle-mainnet.bean.exchange/v1/oracle-params";

/**
 * Fetch oracle params from API for order execution
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

/**
 * Get order type name from enum value
 */
function getOrderTypeName(orderType: number): string {
  const orderTypes = [
    "MarketSwap",
    "LimitSwap",
    "MarketIncrease",
    "LimitIncrease",
    "MarketDecrease",
    "LimitDecrease",
    "StopLossDecrease",
    "Liquidation",
  ];
  return orderTypes[orderType] || `Unknown(${orderType})`;
}

async function main() {
  const dataStore = await ethers.getContract("DataStore");
  const orderHandler = await ethers.getContract("OrderHandler");
  const reader = await ethers.getContract("Reader");

  const [wallet] = await ethers.getSigners();
  console.log("Executor wallet:", wallet.address);

  const orderCount = await dataStore.getBytes32Count(keys.ORDER_LIST);
  console.log("Pending orders count:", orderCount.toString());
  if (orderCount.eq(0)) {
    console.log("No pending orders to execute");
    return;
  }

  const orderKeys = await dataStore.getBytes32ValuesAt(keys.ORDER_LIST, 0, 1);
  const orderKey = orderKeys[0];
  console.log("Using first pending order key:", orderKey);

  const order = await reader.getOrder(dataStore.address, orderKey);
  if (order.addresses.account === ethers.constants.AddressZero) {
    console.log("Order not found or already executed:", orderKey);
    return;
  }

  console.log("\n=== Order Details ===");
  console.log("Account:", order.addresses.account);
  console.log("Receiver:", order.addresses.receiver);
  console.log("Market:", order.addresses.market);
  console.log("Initial Collateral Token:", order.addresses.initialCollateralToken);
  console.log("Order Type:", getOrderTypeName(order.numbers.orderType));
  console.log("Size Delta USD:", order.numbers.sizeDeltaUsd.toString());
  console.log("Initial Collateral Delta Amount:", order.numbers.initialCollateralDeltaAmount.toString());
  console.log("Trigger Price:", order.numbers.triggerPrice.toString());
  console.log("Acceptable Price:", order.numbers.acceptablePrice.toString());
  console.log("Execution Fee:", order.numbers.executionFee.toString());
  console.log("Min Output Amount:", order.numbers.minOutputAmount.toString());
  console.log("Is Long:", order.flags.isLong);
  console.log("Is Frozen:", order.flags.isFrozen);
  console.log("Updated At Block:", order.numbers.updatedAtBlock.toString());
  console.log("Updated At Time:", order.numbers.updatedAtTime.toString());

  // Check expiration
  const requestExpirationTime = await dataStore.getUint(keys.REQUEST_EXPIRATION_TIME);
  const currentBlock = await ethers.provider.getBlock("latest");
  const expirationTime = order.numbers.updatedAtTime.add(requestExpirationTime);
  const isExpired = currentBlock.timestamp > expirationTime.toNumber();

  console.log("\n=== Expiration Check ===");
  console.log("Request Expiration Time:", requestExpirationTime.toString(), "seconds");
  console.log("Order Created At:", new Date(order.numbers.updatedAtTime.toNumber() * 1000).toISOString());
  console.log("Expires At:", new Date(expirationTime.toNumber() * 1000).toISOString());
  console.log("Current Time:", new Date(currentBlock.timestamp * 1000).toISOString());
  console.log("Is Expired:", isExpired ? "❌ YES" : "✓ NO");

  if (isExpired) {
    const expiredFor = currentBlock.timestamp - expirationTime.toNumber();
    console.log(`\n❌ Order has EXPIRED ${expiredFor} seconds ago!`);
    console.log("Cancelling expired order...");

    const isOrderOwner = order.addresses.account.toLowerCase() === wallet.address.toLowerCase();
    console.log(`Wallet is order owner: ${isOrderOwner}`);

    try {
      const gasLimit = 1000000; // 1M gas
      const tx = await orderHandler.cancelOrder(orderKey, { gasLimit });

      console.log("Cancel tx sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Order cancelled!");
      console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
      if (receipt.status !== 1) {
        console.error("❌ Transaction reverted on-chain");
      }
    } catch (cancelError: any) {
      console.error("Failed to cancel order:", cancelError.reason || cancelError.message);
    }
    return;
  }

  // Check if order is frozen
  if (order.flags.isFrozen) {
    console.log("\n⚠️  Order is FROZEN!");
    console.log("Frozen orders require FROZEN_ORDER_KEEPER role to execute.");
    const roleStore = await ethers.getContract("RoleStore");
    const FROZEN_ORDER_KEEPER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FROZEN_ORDER_KEEPER"));
    const hasFrozenKeeper = await roleStore.hasRole(wallet.address, FROZEN_ORDER_KEEPER);
    console.log(`Wallet has FROZEN_ORDER_KEEPER role: ${hasFrozenKeeper}`);
    if (!hasFrozenKeeper) {
      console.log("Cannot execute frozen order without FROZEN_ORDER_KEEPER role.");
      return;
    }
  }

  // Fetch oracle params from API
  console.log("\n=== Fetching Oracle Params ===");
  const oracleParams = await fetchOracleParams(order.addresses.account, order.addresses.market);
  console.log("Oracle params fetched successfully");

  try {
    console.log("Sending transaction...");
    const tx = await orderHandler.executeOrder(orderKey, oracleParams);

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  } catch (error: any) {
    console.error("\n=== Execution Failed ===");
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
