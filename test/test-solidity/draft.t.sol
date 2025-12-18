// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {TestCommon, USDC} from "./TestCommon.t.sol";

import {ExchangeRouter} from "../../contracts/router/ExchangeRouter.sol";
import {DepositVault} from "../../contracts/deposit/DepositVault.sol";
import {DepositUtils} from "../../contracts/deposit/DepositUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OracleUtils} from "../../contracts/oracle/OracleUtils.sol";
import {PythPriceFeedProvider} from "../../contracts/oracle/PythPriceFeedProvider.sol";
import {console} from "forge-std/console.sol";
import {DataStore} from "../../contracts/data/DataStore.sol";
import {Keys} from "../../contracts/data/Keys.sol";

contract DraftTest is TestCommon {
    ExchangeRouter public exchangeRouter = ExchangeRouter(0x50EA3bdd55bfD4a3554b3C2f3CFe9652200653A5);

    DepositVault public depositVault = DepositVault(payable(0xD041cDF06EE116D8020Aa68eAe9d06A23CDE8844));

    address public testUSDC = 0x2BE286D3ff75E380ea9695D7cdA7e7292444C19E;
    address public wbtc = 0x0555E30da8f98308EdB960aa94C0Db47230d2B9c;
    address public wbtcUsdcMarketAddress = 0xDd0d98Fe3A1dA74e2A022a6AFf8EaeC923374c6D;
    address public pythPriceFeedProvider = 0x0Bd0347516baa015a0E93aA7ba8dF786E0ECcf0B;

    function setUp() public override {
        super.setUp();
        setErc20Balance(testUSDC, user, 10000 * 1e6);
        setErc20Balance(wbtc, user, 10000 * 1e18);
    }

    function test_draft() public {
        vm.startBroadcast(user);
        skip(1 days);
        IERC20(testUSDC).transfer(address(depositVault), 100 * 1e6);
        DepositUtils.CreateDepositParams memory params = DepositUtils.CreateDepositParams({
            receiver: user,
            callbackContract: address(0),
            uiFeeReceiver: address(0),
            market: wbtcUsdcMarketAddress,
            initialLongToken: testUSDC,
            initialShortToken: testUSDC,
            longTokenSwapPath: new address[](0),
            shortTokenSwapPath: new address[](0),
            minMarketTokens: 0,
            shouldUnwrapNativeToken: false,
            executionFee: 0,
            callbackGasLimit: 0
        });
        bytes[] memory oracleData = new bytes[](2);
        address[] memory providers = new address[](2);
        providers[0] = pythPriceFeedProvider;
        providers[1] = pythPriceFeedProvider;
        address[] memory tokens = new address[](2);
        tokens[0] = wbtc;
        tokens[1] = testUSDC;
        OracleUtils.SetPricesParams memory oracleParams = OracleUtils.SetPricesParams({
            tokens: tokens,
            providers: providers,
            data: oracleData
        });
        exchangeRouter.executeAtomicDeposit(params, oracleParams);
    }
}
