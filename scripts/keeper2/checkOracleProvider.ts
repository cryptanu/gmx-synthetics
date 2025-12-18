import hre from "hardhat";
const { ethers } = hre;
import * as keys from "../../utils/keys";

async function main() {
  const dataStore = await ethers.getContract("DataStore");

  console.log("=".repeat(60));
  console.log("=== All Oracle Providers Status ===");
  console.log("=".repeat(60));

  const providerContracts = [
    "GmOracleProvider",
    "ChainlinkPriceFeedProvider",
    "ChainlinkDataStreamProvider",
    "PythPriceFeedProvider",
  ];

  const providers: { name: string; address: string; enabled: boolean; atomic: boolean }[] = [];

  for (const contractName of providerContracts) {
    try {
      const provider = await ethers.getContract(contractName);
      const isEnabled = await dataStore.getBool(keys.isOracleProviderEnabledKey(provider.address));
      const isAtomic = await dataStore.getBool(keys.isAtomicOracleProviderKey(provider.address));

      providers.push({
        name: contractName,
        address: provider.address,
        enabled: isEnabled,
        atomic: isAtomic,
      });

      const atomicLabel = isAtomic ? "ATOMIC" : "NON-ATOMIC";
      const enabledLabel = isEnabled ? "✓ ENABLED" : "✗ DISABLED";
      console.log(`\n${contractName}:`);
      console.log(`  Address: ${provider.address}`);
      console.log(`  Status: ${enabledLabel} | ${atomicLabel}`);
    } catch (e) {
      console.log(`\n${contractName}: NOT DEPLOYED`);
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
