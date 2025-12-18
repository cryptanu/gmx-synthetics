// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {TestCommon, WBTC, USDC, PYTH, WBTC_FEED_ID, USDC_FEED_ID, TEST_USDC, WMON, WMON_FEED_ID} from "./TestCommon.t.sol";

import {ExchangeRouter} from "../../contracts/router/ExchangeRouter.sol";
import {DepositVault} from "../../contracts/deposit/DepositVault.sol";
import {DepositUtils} from "../../contracts/deposit/DepositUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OracleUtils} from "../../contracts/oracle/OracleUtils.sol";
import {console} from "forge-std/console.sol";
import {RoleStore} from "../../contracts/role/RoleStore.sol";
import {DataStore} from "../../contracts/data/DataStore.sol";
import {EventEmitter} from "../../contracts/event/EventEmitter.sol";
import {Oracle} from "../../contracts/oracle/Oracle.sol";
import {OracleStore} from "../../contracts/oracle/OracleStore.sol";
import {DepositVault} from "../../contracts/deposit/DepositVault.sol";
import {DepositHandler} from "../../contracts/exchange/DepositHandler.sol";
import {WithdrawalVault} from "../../contracts/withdrawal/WithdrawalVault.sol";
import {WithdrawalHandler} from "../../contracts/exchange/WithdrawalHandler.sol";

import {SwapHandler} from "../../contracts/swap/SwapHandler.sol";

import {ReferralStorage} from "../../contracts/mock/ReferralStorage.sol";
import {OrderVault} from "../../contracts/order/OrderVault.sol";
import {OrderHandler} from "../../contracts/exchange/OrderHandler.sol";
import {Router} from "../../contracts/router/Router.sol";
import {MarketFactory} from "../../contracts/market/MarketFactory.sol";
import {Market} from "../../contracts/market/Market.sol";

import {Keys} from "../../contracts/data/Keys.sol";
import {Role} from "../../contracts/role/Role.sol";

import {ShiftHandler} from "../../contracts/exchange/ShiftHandler.sol";
import {ShiftVault} from "../../contracts/shift/ShiftVault.sol";

import {ExternalHandler} from "../../contracts/external/ExternalHandler.sol";
import {AggregatorV2V3Interface} from "chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV2V3Interface.sol";
import {PythPriceFeedProvider} from "../../contracts/oracle/PythPriceFeedProvider.sol";

contract DraftTest is TestCommon {
    RoleStore public roleStore;
    DataStore public dataStore;
    EventEmitter public eventEmitter;

    AggregatorV2V3Interface public sequencerUptimeFeed;

    Oracle public oracle;
    OracleStore public oracleStore;

    DepositVault public depositVault;
    DepositHandler public depositHandler;

    WithdrawalVault public withdrawalVault;
    WithdrawalHandler public withdrawalHandler;

    SwapHandler public swapHandler;
    ReferralStorage public referralStorage;

    OrderVault public orderVault;
    OrderHandler public orderHandler;
    Router public router;
    ExchangeRouter public exchangeRouter;
    MarketFactory public marketFactory;
    Market.Props public market;

    ShiftHandler public shiftHandler;
    ShiftVault public shiftVault;

    ExternalHandler public externalHandler;

    PythPriceFeedProvider public pythPriceFeedProvider;

    function setUp() public override {
        super.setUp();
        vm.startBroadcast(admin);
        // deploy perp contracts
        roleStore = new RoleStore();
        roleStore.grantRole(admin, Role.CONTROLLER);
        dataStore = new DataStore(roleStore);
        oracleStore = new OracleStore(roleStore, eventEmitter);
        eventEmitter = new EventEmitter(roleStore);
        oracle = new Oracle(roleStore, dataStore, eventEmitter, sequencerUptimeFeed);
        roleStore.grantRole(address(oracle), Role.CONTROLLER);

        depositVault = new DepositVault(roleStore, dataStore);
        depositHandler = new DepositHandler(roleStore, dataStore, eventEmitter, oracle, depositVault);
        roleStore.grantRole(address(depositHandler), Role.CONTROLLER);

        withdrawalVault = new WithdrawalVault(roleStore, dataStore);
        withdrawalHandler = new WithdrawalHandler(roleStore, dataStore, eventEmitter, oracle, withdrawalVault);

        shiftVault = new ShiftVault(roleStore, dataStore);
        shiftHandler = new ShiftHandler(roleStore, dataStore, eventEmitter, oracle, shiftVault);
        roleStore.grantRole(address(shiftHandler), Role.CONTROLLER);

        swapHandler = new SwapHandler(roleStore);
        roleStore.grantRole(address(swapHandler), Role.CONTROLLER);

        orderVault = new OrderVault(roleStore, dataStore);
        referralStorage = new ReferralStorage();
        roleStore.grantRole(address(referralStorage), Role.CONTROLLER);

        orderHandler = new OrderHandler(
            roleStore,
            dataStore,
            eventEmitter,
            oracle,
            orderVault,
            swapHandler,
            referralStorage
        );
        roleStore.grantRole(address(orderHandler), Role.CONTROLLER);

        router = new Router(roleStore);

        exchangeRouter = new ExchangeRouter(
            router,
            roleStore,
            dataStore,
            eventEmitter,
            depositHandler,
            withdrawalHandler,
            shiftHandler,
            orderHandler,
            externalHandler
        );

        marketFactory = new MarketFactory(roleStore, dataStore, eventEmitter);

        roleStore.grantRole(address(marketFactory), Role.CONTROLLER);

        roleStore.grantRole(address(exchangeRouter), Role.CONTROLLER);
        roleStore.grantRole(address(exchangeRouter), Role.ROUTER_PLUGIN);

        roleStore.grantRole(admin, Role.MARKET_KEEPER);

        dataStore.setUint(Keys.MAX_ORACLE_PRICE_AGE, 10 ** 60);
        dataStore.setUint(Keys.MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR, 10 ** 30);

        dataStore.setUint(Keys.tokenTransferGasLimit(TEST_USDC), 200_000);
        dataStore.setUint(Keys.tokenTransferGasLimit(WMON), 200_000);
        dataStore.setUint(Keys.tokenTransferGasLimit(WBTC), 200_000);
        dataStore.setUint(Keys.tokenTransferGasLimit(USDC), 200_000);

        pythPriceFeedProvider = new PythPriceFeedProvider(dataStore);
        dataStore.setAddress(Keys.PYTH_PRICE_FEED_ADDRESS, PYTH);
        dataStore.setUint(Keys.PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP, 30);

        dataStore.setBytes32(Keys.pythPriceFeedIdKey(WBTC), WBTC_FEED_ID);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(USDC), USDC_FEED_ID);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(TEST_USDC), USDC_FEED_ID);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(WMON), WMON_FEED_ID);

        dataStore.setBool(Keys.isAtomicOracleProviderKey(address(pythPriceFeedProvider)), true);
        dataStore.setBool(Keys.isOracleProviderEnabledKey(address(pythPriceFeedProvider)), true);

        dataStore.setAddress(Keys.priceFeedKey(WBTC), address(pythPriceFeedProvider));
        dataStore.setAddress(Keys.priceFeedKey(USDC), address(pythPriceFeedProvider));
        dataStore.setAddress(Keys.priceFeedKey(TEST_USDC), address(pythPriceFeedProvider));
        dataStore.setAddress(Keys.priceFeedKey(WMON), address(pythPriceFeedProvider));

        dataStore.setAddress(Keys.WNT, WMON);
        setErc20Balance(WMON, admin, 10000 * 1e18);
        setErc20Balance(TEST_USDC, admin, 10000 * 1e6);

        vm.stopBroadcast();
    }

    function test_deployment() public {}

    function createMarket(
        address indexToken,
        address longToken,
        address shortToken
    ) public returns (Market.Props memory) {
        vm.startBroadcast(admin);
        Market.Props memory _market = marketFactory.createMarket(indexToken, longToken, shortToken, "GMX_MARKET");
        dataStore.setUint(Keys.maxPoolUsdForDepositKey(_market.marketToken, longToken), 10_000_000 * 10 ** 30); // 10M USD
        dataStore.setUint(Keys.maxPoolUsdForDepositKey(_market.marketToken, shortToken), 10_000_000 * 10 ** 30); // 10M USD
        dataStore.setUint(Keys.maxPoolAmountKey(_market.marketToken, longToken), 5_000_000 * 10 ** 6); // 5M tokens
        dataStore.setUint(Keys.maxPoolAmountKey(_market.marketToken, shortToken), 5_000_000 * 10 ** 6); // 5M tokens
        vm.stopBroadcast();
        return _market;
    }

    function test_depositAtomic() public {
        Market.Props memory _market = createMarket(WBTC, TEST_USDC, TEST_USDC);
        vm.startBroadcast(admin);

        uint256 amountDeposit = 100;

        setErc20Balance(TEST_USDC, admin, amountDeposit * 10 * 1e6);

        IERC20(TEST_USDC).transfer(address(depositVault), amountDeposit * 1e6);
        DepositUtils.CreateDepositParams memory params = DepositUtils.CreateDepositParams({
            receiver: admin,
            callbackContract: address(0),
            uiFeeReceiver: address(0),
            market: _market.marketToken,
            initialLongToken: TEST_USDC,
            initialShortToken: TEST_USDC,
            longTokenSwapPath: new address[](0),
            shortTokenSwapPath: new address[](0),
            minMarketTokens: 0,
            shouldUnwrapNativeToken: false,
            executionFee: 0,
            callbackGasLimit: 0
        });
        bytes[] memory oracleData = new bytes[](2);
        address[] memory providers = new address[](2);
        providers[0] = address(pythPriceFeedProvider);
        providers[1] = address(pythPriceFeedProvider);
        address[] memory tokens = new address[](2);
        tokens[0] = WBTC;
        tokens[1] = TEST_USDC;
        OracleUtils.SetPricesParams memory oracleParams = OracleUtils.SetPricesParams({
            tokens: tokens,
            providers: providers,
            data: oracleData
        });

        uint256 balanceGmBefore = IERC20(_market.marketToken).balanceOf(admin);
        exchangeRouter.executeAtomicDeposit(params, oracleParams);
        uint256 balanceGmAfter = IERC20(_market.marketToken).balanceOf(admin);

        uint256 balanceGm = balanceGmAfter - balanceGmBefore;

        assertApproxEqAbs(balanceGm, amountDeposit * 1e18, (amountDeposit * 1e18) / 1000);
        vm.stopBroadcast();
    }
}
