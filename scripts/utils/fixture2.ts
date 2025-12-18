/**
 * @todo review
 * - used for keepers in production
 */
import hre from "hardhat";
import { hashData } from "../../utils/hash";
import { getMarketTokenAddress, DEFAULT_MARKET_TYPE } from "../../utils/market";

const { ethers, network } = hre;

export async function deployFixture() {
  const chainId = network.config.chainId;
  const accountList = await hre.ethers.getSigners();
  const [
    wallet,
    user0,
    user1,
    user2,
    user3,
    user4,
    user5,
    user6,
    user7,
    user8,
    signer,
  ] = accountList;

  console.log("[WARN] >>>> Loading Keeper Env ...");
  console.log("chainId: %s", chainId);
  console.log("wallet: %s", wallet.address);
  console.log("user0: %s", user0.address);
  console.log("user1: %s", user1.address);
  console.log("user2: %s", user2.address);
  console.log("user3: %s", user3.address);
  console.log("user4: %s", user4.address);
  console.log("user5: %s", user5.address);
  console.log("user6: %s", user6.address);
  console.log("user7: %s", user7.address);
  console.log("user8: %s", user8.address);
  console.log("signer: %s", signer.address);

  // @todo use preconfigured token address ?
  const wnt = await hre.ethers.getContract("WMON");
  const weth = await hre.ethers.getContract("WETH");
  const usdc = await hre.ethers.getContract("USDC");

  // @todo review oracle salt, should change ?
  const oracleSalt = hashData(["uint256", "string"], [chainId, "xget-oracle-v1"]);

  const config = await hre.ethers.getContract("Config");
  const timelock = await hre.ethers.getContract("Timelock");
  const reader = await hre.ethers.getContract("Reader");
  const roleStore = await hre.ethers.getContract("RoleStore");
  const dataStore = await hre.ethers.getContract("DataStore");
  const depositVault = await hre.ethers.getContract("DepositVault");
  const withdrawalVault = await hre.ethers.getContract("WithdrawalVault");
  const eventEmitter = await hre.ethers.getContract("EventEmitter");
  const oracleStore = await hre.ethers.getContract("OracleStore");
  const orderVault = await hre.ethers.getContract("OrderVault");
  const marketFactory = await hre.ethers.getContract("MarketFactory");
  const depositHandler = await hre.ethers.getContract("DepositHandler");
  const depositUtils = await hre.ethers.getContract("DepositUtils");
  const executeDepositUtils = await hre.ethers.getContract("ExecuteDepositUtils");
  const withdrawalHandler = await hre.ethers.getContract("WithdrawalHandler");
  const orderHandler = await hre.ethers.getContract("OrderHandler");
  const baseOrderUtils = await hre.ethers.getContract("BaseOrderUtils");
  const orderUtils = await hre.ethers.getContract("OrderUtils");
  const liquidationHandler = await hre.ethers.getContract("LiquidationHandler");
  const adlHandler = await hre.ethers.getContract("AdlHandler");
  const router = await hre.ethers.getContract("Router");
  const exchangeRouter = await hre.ethers.getContract("ExchangeRouter");
  const subaccountRouter = await hre.ethers.getContract("SubaccountRouter");
  const oracle = await hre.ethers.getContract("Oracle");
  const marketUtils = await hre.ethers.getContract("MarketUtils");
  const marketStoreUtils = await hre.ethers.getContract("MarketStoreUtils");
  const depositStoreUtils = await hre.ethers.getContract("DepositStoreUtils");
  const withdrawalStoreUtils = await hre.ethers.getContract("WithdrawalStoreUtils");
  const positionStoreUtils = await hre.ethers.getContract("PositionStoreUtils");
  const orderStoreUtils = await hre.ethers.getContract("OrderStoreUtils");
  const decreasePositionUtils = await hre.ethers.getContract("DecreasePositionUtils");
  const increaseOrderUtils = await hre.ethers.getContract("IncreaseOrderUtils");
  const increasePositionUtils = await hre.ethers.getContract("IncreasePositionUtils");
  const positionUtils = await hre.ethers.getContract("PositionUtils");
  const swapUtils = await hre.ethers.getContract("SwapUtils");
  const referralStorage = await hre.ethers.getContract("ReferralStorage");
  const referralReader = await hre.ethers.getContract("ReferralReader");
  const feeHandler = await hre.ethers.getContract("FeeHandler");
  const multicall = await hre.ethers.getContract("Multicall");

  const ethUsdMarketAddress = getMarketTokenAddress(
    weth.address,
    usdc.address,
    usdc.address,
    DEFAULT_MARKET_TYPE,
    marketFactory.address,
    roleStore.address,
    dataStore.address
  );
  const ethUsdMarket = await reader.getMarket(dataStore.address, ethUsdMarketAddress);

  console.log("[WARN] >>>> Loading Keeper Env ... done!");
  return {
    accountList,
    provider: ethers.provider,
    getContract: async (contractName) => {
      return await hre.ethers.getContract(contractName);
    },
    accounts: {
      wallet,
      user0,
      user1,
      user2,
      user3,
      user4,
      user5,

      user6,
      user7,

      user8,
      signer,
      signers: [signer],
      depositKeepers: [wallet, user0],
      orderKeepers: [user1, user2, user3, user4, user5],
      withdrawKeepers: [user6, user7],
    },
    contracts: {
      config,
      timelock,
      reader,
      roleStore,
      dataStore,
      depositVault,
      eventEmitter,
      withdrawalVault,
      oracleStore,
      orderVault,
      marketFactory,
      depositHandler,
      depositUtils,
      executeDepositUtils,
      withdrawalHandler,
      orderHandler,
      baseOrderUtils,
      orderUtils,
      liquidationHandler,
      adlHandler,
      router,
      exchangeRouter,
      subaccountRouter,
      oracle,
      marketUtils,
      marketStoreUtils,
      depositStoreUtils,
      withdrawalStoreUtils,
      positionStoreUtils,
      orderStoreUtils,
      decreasePositionUtils,
      increaseOrderUtils,
      increasePositionUtils,
      positionUtils,
      swapUtils,
      referralStorage,
      wnt,
      weth,
      usdc,
      ethUsdMarket,
      feeHandler,
      referralReader,
      multicall
    },
    //@todo why executionFee too much
    props: { oracleSalt, signerIndexes: [0], executionFee: "1000000000000000" },
  };
}
