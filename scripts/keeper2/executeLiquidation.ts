import hre from "hardhat";
const { ethers } = hre;
import * as keys from "../../utils/keys";

const ORACLE_API_URL = "https://oracle-mainnet.bean.exchange/v1/oracle-params";

/**
 * Fetch oracle params from API for liquidation
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
  const liquidationHandler = await ethers.getContract("LiquidationHandler");
  const reader = await ethers.getContract("Reader");

  const [wallet] = await ethers.getSigners();
  console.log("Liquidation keeper wallet:", wallet.address);

  // Check if wallet has LIQUIDATION_KEEPER role
  const roleStore = await ethers.getContract("RoleStore");
  const LIQUIDATION_KEEPER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LIQUIDATION_KEEPER"));
  const hasLiquidationKeeper = await roleStore.hasRole(wallet.address, LIQUIDATION_KEEPER);
  console.log(`Wallet has LIQUIDATION_KEEPER role: ${hasLiquidationKeeper}`);
  if (!hasLiquidationKeeper) {
    console.log("Cannot execute liquidation without LIQUIDATION_KEEPER role.");
    return;
  }

  // Get all positions
  const positionCount = await dataStore.getBytes32Count(keys.POSITION_LIST);
  console.log("Total positions count:", positionCount.toString());

  if (positionCount.eq(0)) {
    console.log("No positions to check for liquidation");
    return;
  }

  // Get first position to liquidate (you can modify to iterate all positions)
  const positionKeys = await dataStore.getBytes32ValuesAt(keys.POSITION_LIST, 0, positionCount);

  for (let i = 0; i < positionKeys.length; i++) {
    const positionKey = positionKeys[i];
    console.log(`\n=== Checking Position ${i + 1}/${positionKeys.length} ===`);
    console.log("Position key:", positionKey);

    const position = await reader.getPosition(dataStore.address, positionKey);

    if (position.addresses.account === ethers.constants.AddressZero) {
      console.log("Position not found or already closed");
      continue;
    }

    console.log("Account:", position.addresses.account);
    console.log("Market:", position.addresses.market);
    console.log("Collateral Token:", position.addresses.collateralToken);
    console.log("Is Long:", position.flags.isLong);
    console.log("Size In USD:", ethers.utils.formatUnits(position.numbers.sizeInUsd, 30));
    console.log("Size In Tokens:", position.numbers.sizeInTokens.toString());
    console.log("Collateral Amount:", position.numbers.collateralAmount.toString());

    // Try to execute liquidation
    try {
      console.log("\n=== Attempting Liquidation ===");

      // Fetch oracle params
      const oracleParams = await fetchOracleParams(position.addresses.account, position.addresses.market);
      console.log("Oracle params fetched successfully");

      console.log("Sending liquidation transaction...");
      const tx = await liquidationHandler.executeLiquidation(
        position.addresses.account,
        position.addresses.market,
        position.addresses.collateralToken,
        position.flags.isLong,
        oracleParams,
        { gasLimit: 3000000 }
      );

      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed!");
      console.log("Status:", receipt.status === 1 ? "SUCCESS - Position Liquidated!" : "FAILED");

      if (receipt.status === 1) {
        console.log("Gas used:", receipt.gasUsed.toString());
      }
    } catch (error: any) {
      // This is expected if position is not liquidatable
      const reason = error.reason || error.message || "";
      if (reason.includes("PositionShouldNotBeLiquidated") || reason.includes("not liquidatable")) {
        console.log("Position is healthy - not liquidatable");
      } else {
        console.error("Liquidation failed:", reason);
        const errorData = error.data || error.error?.data;
        if (errorData && errorData !== "0x") {
          console.error("Raw error data:", typeof errorData === "string" ? errorData.slice(0, 200) : errorData);
        }
      }
    }
  }

  console.log("\n=== Liquidation Check Complete ===");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
