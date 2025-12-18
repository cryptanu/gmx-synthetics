// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {TestCommon, PYTH, WETH, WETH_FEED_ID} from "../TestCommon.t.sol";
import {PythPriceFeedProvider} from "contracts/oracle/PythPriceFeedProvider.sol";
import {OracleUtils} from "contracts/oracle/OracleUtils.sol";

contract PythOracleProviderTest is TestCommon {
    PythPriceFeedProvider public pythPriceFeedProvider;

    function setUp() public override {
        super.setUp();

        pythPriceFeedProvider = new PythPriceFeedProvider(admin, 18, PYTH);
    }

    function test_initialization() public {
        assertEq(pythPriceFeedProvider.owner(), admin);
        assertEq(pythPriceFeedProvider.decimals(), 18);
        assertEq(address(pythPriceFeedProvider.pyth()), PYTH);
    }

    function test_getOraclePrice_withPriceFeedIdNotSet_shouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(PythPriceFeedProvider.Pyth__EmptyPriceFeed.selector, WETH));
        pythPriceFeedProvider.getOraclePrice(WETH, "");
    }

    function test_getOraclePrice_withPriceFeedIdSet_shouldReturnPrice() public {
        vm.startBroadcast(admin);
        pythPriceFeedProvider.setPriceFeedId(WETH, WETH_FEED_ID);
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
        vm.expectRevert(abi.encodeWithSelector(PythPriceFeedProvider.Pyth__Unauthorized.selector, user, "Owner"));

        vm.startBroadcast(user);
        pythPriceFeedProvider.setPriceFeedId(WETH, WETH_FEED_ID);
        vm.stopBroadcast();
    }

    function test_setPriceFeedId_withValidOwner_shouldSetPriceFeedId() public {
        vm.startBroadcast(admin);
        pythPriceFeedProvider.setPriceFeedId(WETH, WETH_FEED_ID);
        vm.stopBroadcast();
    }

    function test_setOwner_withInvalidOwner_shouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(PythPriceFeedProvider.Pyth__Unauthorized.selector, user, "Owner"));

        vm.startBroadcast(user);
        pythPriceFeedProvider.setOwner(user);
        vm.stopBroadcast();
    }

    function test_setOwner_withValidOwner_shouldSetOwner() public {
        vm.startBroadcast(admin);
        pythPriceFeedProvider.setOwner(user);
        vm.stopBroadcast();
        assertEq(pythPriceFeedProvider.owner(), user);
    }
}
