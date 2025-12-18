// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./IOracleProvider.sol";

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @title PythPriceFeedProvider
/// @notice Oracle provider implementation that fetches price data from Pyth Network
/// @dev This contract implements IOracleProvider interface and converts Pyth price feeds
///      to the standard ValidatedPrice format with min/max price bounds based on confidence intervals
contract PythPriceFeedProvider is IOracleProvider {
    /// @custom:error Pyth__InvalidPrice Thrown when price is negative or exponent is out of valid range
    /// @param price The invalid price value
    /// @param expo The invalid exponent value
    error Pyth__InvalidPrice(int64 price, int32 expo);

    /// @custom:error Pyth__InvalidScale Thrown when exponent is outside the valid range [-18, 18]
    /// @param expo The invalid exponent value
    error Pyth__InvalidScale(int32 expo);

    /// @custom:error Pyth__EmptyPriceFeed Thrown when no price feed ID is configured for the token
    /// @param token The token address that has no price feed configured
    error Pyth__EmptyPriceFeed(address token);

    /// @custom:error Pyth__Unauthorized Thrown when a function is called by an unauthorized address
    /// @param sender The address that attempted the unauthorized action
    /// @param role The required role that the sender lacks
    error Pyth__Unauthorized(address sender, string role);

    /// @custom:event Pyth_PriceFeedIdSet Emitted when a price feed ID is set for a token
    /// @param token The token address
    /// @param priceFeedId The Pyth price feed ID for the token
    event Pyth_PriceFeedIdSet(address token, bytes32 priceFeedId);

    /// @custom:event Pyth_OwnerSet Emitted when the owner is changed
    /// @param newOwner The new owner address
    event Pyth_OwnerSet(address newOwner);

    /// @notice The owner address that can configure price feeds and transfer ownership
    address public owner;

    /// @notice The number of decimals to scale prices to
    uint8 public decimals;

    /// @notice The Pyth oracle contract address
    IPyth public immutable pyth;

    /// @notice Mapping from token address to Pyth price feed ID
    mapping(address => bytes32) public priceFeedIds;

    /// @notice Modifier that restricts function access to the owner only
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Pyth__Unauthorized(msg.sender, "Owner");
        }
        _;
    }

    /// @notice Initializes the PythPriceFeedProvider contract
    /// @dev Sets the owner, decimals, and Pyth oracle address
    /// @param _owner The initial owner address
    /// @param _decimals The number of decimals for price scaling
    /// @param _pyth The Pyth oracle contract address
    constructor(address _owner, uint8 _decimals, address _pyth) {
        owner = _owner;
        decimals = _decimals;
        pyth = IPyth(_pyth);
    }

    /// @notice Retrieves the oracle price for a given token from Pyth Network
    /// @dev Fetches price from Pyth, converts it to the target decimals, and calculates
    ///      min/max bounds using the confidence interval. The timestamp is taken from
    ///      Pyth's publishTime.
    /// @param token The token address to get the price for
    /// @return ValidatedPrice struct containing token, min price, max price, timestamp, and provider address
    function getOraclePrice(
        address token,
        bytes memory /* data */
    ) external view returns (OracleUtils.ValidatedPrice memory) {
        if (priceFeedIds[token] == bytes32(0)) {
            revert Pyth__EmptyPriceFeed(token);
        }
        PythStructs.Price memory pythPrice = pyth.getPriceUnsafe(priceFeedIds[token]);

        uint256 scaledPriceUint = _convertPythPrice(pythPrice.price, pythPrice.expo);
        uint256 scaledConfUint = _convertPythValue(pythPrice.conf, pythPrice.expo);

        return
            OracleUtils.ValidatedPrice({
                token: token,
                min: scaledPriceUint - scaledConfUint,
                max: scaledPriceUint + scaledConfUint,
                timestamp: pythPrice.publishTime,
                provider: address(this)
            });
    }

    /// @notice Sets the Pyth price feed ID for a token
    /// @dev Only callable by the owner. Emits Pyth_PriceFeedIdSet event.
    /// @param token The token address to configure
    /// @param priceFeedId The Pyth price feed ID for the token
    function setPriceFeedId(address token, bytes32 priceFeedId) external onlyOwner {
        priceFeedIds[token] = priceFeedId;
        emit Pyth_PriceFeedIdSet(token, priceFeedId);
    }

    /// @notice Transfers ownership of the contract to a new address
    /// @dev Only callable by the current owner. Emits Pyth_OwnerSet event.
    /// @param newOwner The address to transfer ownership to
    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
        emit Pyth_OwnerSet(newOwner);
    }

    /// @notice Converts a Pyth price value to the target decimals
    /// @dev Validates that price is non-negative and exponent is in valid range [-18, 18]
    /// @param _price The Pyth price value (int64)
    /// @param _expo The Pyth price exponent (int32)
    /// @return The converted price value scaled to the target decimals
    function _convertPythPrice(int64 _price, int32 _expo) internal view returns (uint256) {
        if (_price < 0 || _expo < -18 || _expo > 18) {
            revert Pyth__InvalidPrice(_price, _expo);
        }
        return _convertPythValue(uint64(_price), _expo);
    }

    /// @notice Converts a Pyth value (price or confidence) to the target decimals
    /// @dev Handles both positive and negative exponents. For positive exponents, scales up.
    ///      For negative exponents, scales to decimals first then divides by 10^(-expo).
    /// @param _value The Pyth value to convert (uint64)
    /// @param _expo The Pyth exponent (int32, must be in range [-18, 18])
    /// @return The converted value scaled to the target decimals
    function _convertPythValue(uint64 _value, int32 _expo) internal view returns (uint256) {
        uint256 dominator = 10 ** (decimals);
        if (_expo < -18 || _expo > 18) {
            revert Pyth__InvalidScale(_expo);
        }
        uint256 value = uint256(_value);
        if (_expo >= 0) {
            return value * (10 ** uint32(_expo)) * (10 ** (decimals - uint32(_expo)));
        } else {
            uint256 absExpo = uint256(uint32(-_expo));
            uint256 scaled = value * dominator; // scale to decimals first
            return scaled / (10 ** absExpo); // divide by 10^(-expo)
        }
    }
}
