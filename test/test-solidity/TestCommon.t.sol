// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;
import {Test} from "forge-std/Test.sol";
import {stdStorage, StdStorage} from "forge-std/Test.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// https://docs.monad.xyz/developer-essentials/network-information?utm_source=chatgpt.com
address constant USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
address constant TEST_USDC = 0x2BE286D3ff75E380ea9695D7cdA7e7292444C19E;
address constant WMON = 0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A;
address constant WETH = 0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242;
address constant WBTC = 0x0555E30da8f98308EdB960aa94C0Db47230d2B9c;

// PYTH
address constant PYTH = 0x2880aB155794e7179c9eE2e38200202908C17B43;

bytes32 constant USDC_FEED_ID = bytes32(0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a);
bytes32 constant WETH_FEED_ID = bytes32(0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace);
bytes32 constant WMON_FEED_ID = bytes32(0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1);
bytes32 constant WBTC_FEED_ID = bytes32(0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43);

abstract contract TestCommon is Test {
    using stdStorage for StdStorage;

    uint256 public TOLERANCE = 0.005 ether; // = 0.5%

    address public admin;
    address public user;

    function setUp() public virtual {
        uint256 fork = vm.createFork(vm.envString("RPC_URL"));

        vm.selectFork(fork);

        admin = makeAddr("admin");
        user = makeAddr("user");
    }

    function setErc20Balance(address token, address account, uint256 amount) internal {
        stdstore.target(token).sig(IERC20(token).balanceOf.selector).with_key(account).checked_write(amount);
    }
}
