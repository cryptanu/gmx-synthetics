import { setTimeout } from 'timers/promises';
import { loadApiPrices } from "../../utils/priceslive";
import { loadMarkets } from "../utils";
import { getLogger } from "../utils/logger";
import { makePgConnection } from "./utils";

const logger = getLogger("LIQ_RISK_SCORE");
let pgConnection: any = null;

// Main risk score calculation loop
async function main() {
  while(true) {
    try {
      logger.info("------------------------ triggering risk score .... ------------------------");
      
      // Load data
      const probPrices = await loadApiPrices();
      const allMarkets = await loadMarkets();
      const realtimePrices = generateTokenPriceMap(probPrices, allMarkets);
      
      // Log data for debugging
      console.log(">>> Prices: %s", JSON.stringify(probPrices, null, 2));
      console.log(">>> Markets: %s", JSON.stringify(allMarkets, null, 2));
      console.log(">>> RealtimePrices: %s", JSON.stringify(realtimePrices, null, 2));
      
      // Execute risk score calculation
      await triggerRiskScore(realtimePrices);
      
      // Wait before next iteration
      await setTimeout(2000);
    } catch (e) {
      logger.error("Error while triggering risk score", e);
      await setTimeout(5000); // Longer delay after error
    }
  }
}

// Map token prices
function generateTokenPriceMap(prices: any, marketInfos: any) {
  const tokenPriceMap: Record<string, number> = {};
  
  // Add direct token prices
  for (const [tokenAddress, info] of Object.entries(prices)) {
    tokenPriceMap[tokenAddress.toLowerCase()] = Number(info.price);
  }

  // Map market addresses to token prices
  for (const [marketAddr, tokenArray] of Object.entries(marketInfos)) {
    const tokenAddrToMap = tokenArray[1]?.toLowerCase(); // second token in array
    const referencePrice = tokenPriceMap[tokenAddrToMap];
    if (referencePrice !== undefined) {
      tokenPriceMap[marketAddr.toLowerCase()] = referencePrice;
    }
  }

  return tokenPriceMap;
}

// Database connection management
async function getDbConnection(): Promise<any> {
  try {
    // Check if connection exists and is valid
    if (pgConnection) {
      try {
        // Test connection with simple query
        await pgConnection.query('SELECT 1');
        return pgConnection; // Connection is valid
      } catch (connErr) {
        logger.info("Existing connection invalid, creating new connection");
        // Close invalid connection if possible
        try {
          await pgConnection.end();
        } catch (endErr) {
          // Ignore errors when closing invalid connection
        }
      }
    }
    
    // Create new connection
    pgConnection = makePgConnection();
    await pgConnection.connect();
    logger.info("New database connection established");
    return pgConnection;
  } catch (error) {
    logger.error("Failed to establish database connection:", error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

// Calculate risk score
async function triggerRiskScore(realTimePrices: any): Promise<void> {
  try {
    console.log("trigger riskscore ...");
    
    // Get valid database connection
    const db = await getDbConnection();
    
    // Execute stored procedure
    await db.query(
      'CALL sgd14.populate_and_calculate_risk($1, $2);',
      [Object.keys(realTimePrices), Object.values(realTimePrices)]
    );
    
    console.log("trigger success!");
  } catch (err) {
    console.error('trigger got error:', err);
    throw err;
  }
}

// Handle graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  if (pgConnection) {
    try {
      await pgConnection.end();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error('Error closing database connection:', err);
    }
  }
  
  process.exit(0);
}

// Register signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
main().catch((ex) => {
  logger.error("Fatal error in main function:", ex);
  process.exit(1);
});