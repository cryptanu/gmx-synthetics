// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {TestCommon, PYTH, WETH, WETH_FEED_ID} from "../TestCommon.t.sol";

import {PythPriceFeedProvider} from "contracts/oracle/PythPriceFeedProvider.sol";
import {OracleUtils} from "contracts/oracle/OracleUtils.sol";
import {console} from "forge-std/console.sol";
import {DataStore} from "contracts/data/DataStore.sol";
import {RoleStore} from "contracts/role/RoleStore.sol";
import {RoleModule} from "contracts/role/RoleModule.sol";
import {Role} from "contracts/role/Role.sol";
import {Keys} from "contracts/data/Keys.sol";

import {Errors} from "contracts/error/Errors.sol";

contract PythOracleProviderTest is TestCommon {
    PythPriceFeedProvider public pythPriceFeedProvider;

    DataStore public dataStore;
    RoleStore public roleStore;

    function setUp() public override {
        super.setUp();
        vm.startBroadcast(admin);
        roleStore = new RoleStore();
        roleStore.grantRole(admin, Role.CONTROLLER);
        roleStore.grantRole(admin, Role.CONFIG_KEEPER);
        dataStore = new DataStore(roleStore);
        pythPriceFeedProvider = new PythPriceFeedProvider(dataStore);
        dataStore.setAddress(Keys.PYTH_PRICE_FEED_ADDRESS, PYTH);
        dataStore.setUint(Keys.PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP, 30);
        vm.stopBroadcast();
    }

    function test_initialization() public {
        assertEq(pythPriceFeedProvider.DECIMALS(), 30);
    }

    function test_getOraclePrice_withPriceFeedIdNotSet_shouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.PythPriceFeedProviderEmptyPriceFeed.selector, WETH));
        pythPriceFeedProvider.getOraclePrice(WETH, "");
    }

    function test_getOraclePrice_shouldReturnPrice() public {
        vm.startBroadcast(admin);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(WETH), WETH_FEED_ID);
        vm.stopBroadcast();
        OracleUtils.ValidatedPrice memory validatedPrice = pythPriceFeedProvider.getOraclePrice(WETH, "");
        uint256 min = validatedPrice.min;
        uint256 max = validatedPrice.max;
        assertGt((min * 1e18) / 1e30, 2000);
        assertLt((max * 1e18) / 1e30, 4000);
    }

    function test_getOraclePrice_withPriceFeedIdSet_shouldReturnPrice() public {
        vm.startBroadcast(admin);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(WETH), WETH_FEED_ID);
        vm.stopBroadcast();
        OracleUtils.ValidatedPrice memory validatedPrice = pythPriceFeedProvider.getOraclePrice(WETH, "");
        assertEq(validatedPrice.token, WETH);
        assertGt(validatedPrice.min, 0);
        assertLt(validatedPrice.max, type(uint256).max);
        assertLe(validatedPrice.min, validatedPrice.max);
        assertGt(validatedPrice.timestamp, 0);
        assertEq(validatedPrice.provider, address(pythPriceFeedProvider));
    }

    function test_setPriceFeedId_withInvalidOwner_shouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.Unauthorized.selector, user, "CONTROLLER"));
        vm.startBroadcast(user);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(WETH), WETH_FEED_ID);
        vm.stopBroadcast();
    }

    function test_setPriceFeedId_withControllerRole_shouldSucceed() public {
        vm.startBroadcast(admin);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(WETH), WETH_FEED_ID);
        vm.stopBroadcast();
    }

    function test_setAgeTimestamp_withControllerRole_shouldSucceed() public {
        vm.startBroadcast(admin);
        dataStore.setUint(Keys.PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP, 30);
        vm.stopBroadcast();
        uint256 ageTimestamp = dataStore.getUint(Keys.PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP);
        assertEq(ageTimestamp, 30);
    }

    function test_setAgeTimestamp_withoutControllerRole_shouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.Unauthorized.selector, user, "CONTROLLER"));
        vm.startBroadcast(user);
        dataStore.setUint(Keys.PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP, 30);
        vm.stopBroadcast();
    }

    function test_setPriceFeedAddress_withControllerRole_shouldSucceed() public {
        vm.startBroadcast(admin);
        dataStore.setAddress(Keys.PYTH_PRICE_FEED_ADDRESS, PYTH);
        vm.stopBroadcast();
    }

    function test_setPriceFeedAddress_withoutControllerRole_shouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.Unauthorized.selector, user, "CONTROLLER"));
        vm.startBroadcast(user);
        dataStore.setAddress(Keys.PYTH_PRICE_FEED_ADDRESS, PYTH);
        vm.stopBroadcast();
    }

    function test_cacheDecimals_shouldCacheDecimals() public {
        vm.startBroadcast(admin);
        dataStore.setBytes32(Keys.pythPriceFeedIdKey(WETH), WETH_FEED_ID);
        vm.stopBroadcast();
        assertEq(pythPriceFeedProvider.cacheDecimals(WETH), 0);
        OracleUtils.ValidatedPrice memory validatedPrice = pythPriceFeedProvider.getOraclePrice(WETH, "");
        uint8 decimals = pythPriceFeedProvider.cacheDecimals(WETH);
        assertEq(decimals, 18);
    }
}
