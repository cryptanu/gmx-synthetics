// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

interface IPyth {
    function getUpdateFee(bytes[] calldata) external view returns (uint256);

    function updatePriceFeeds(bytes[] calldata) external payable;

    function getPriceNoOlderThan(bytes32, uint256) external view returns (PythStructs.Price memory);
}
