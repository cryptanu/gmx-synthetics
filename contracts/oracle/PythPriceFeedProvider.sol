// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./IOracleProvider.sol";
import "../chain/Chain.sol";

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title PythPriceFeedProvider
/// @notice Oracle provider implementation that fetches price data from Pyth Network
/// @dev This contract implements IOracleProvider interface and converts Pyth price feeds
///      to the standard ValidatedPrice format with min/max price bounds based on confidence intervals
import {DataStore} from "../data/DataStore.sol";

import {Keys} from "../data/Keys.sol";

contract PythPriceFeedProvider is IOracleProvider {
    /// @notice The number of decimals to scale prices to
    /// @dev This is a constant value that is used to scale prices to the target decimals and used in perp
    uint8 public constant DECIMALS = 30;

    /// @notice The data store
    DataStore public immutable dataStore;

    /// @notice The cache of the decimals for the tokens
    mapping(address => uint8) public cacheDecimals;

    /// @notice Initializes the PythPriceFeedProvider contract
    /// @dev Sets the data store
    constructor(DataStore _dataStore) {
        dataStore = _dataStore;
    }

    /// @notice Retrieves the oracle price for a given token from Pyth Network
    /// @dev Fetches price from Pyth, converts it to the target decimals, and calculates
    ///      min/max bounds using the confidence interval. The timestamp returned is based on
    ///      the current blockchain timestamp (similar to ChainlinkPriceFeedProvider) to support
    ///      atomic actions. This is safe because Pyth on-chain price feeds have lower update
    ///      frequency and if used, it is assumed that the feed is sufficiently updated.
    /// @param token The token address to get the price for
    /// @return ValidatedPrice struct containing token, min price, max price, timestamp, and provider address
    function getOraclePrice(
        address token,
        bytes memory /* data */
    ) external returns (OracleUtils.ValidatedPrice memory) {
        bytes32 priceFeedId = dataStore.getBytes32(Keys.pythPriceFeedIdKey(token));
        uint256 ageTimestamp = dataStore.getUint(Keys.PYTH_PRICE_FEED_PROVIDER_AGE_TIMESTAMP);
        IPyth pyth = IPyth(dataStore.getAddress(Keys.PYTH_PRICE_FEED_ADDRESS));
        if (priceFeedId == bytes32(0)) {
            revert Errors.PythPriceFeedProviderEmptyPriceFeed(token);
        }
        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(priceFeedId, ageTimestamp);

        uint256 scaledPriceUint = _convertPythPrice(pythPrice.price, pythPrice.expo);
        uint256 scaledConfUint = _convertPythValue(pythPrice.conf, pythPrice.expo);

        uint8 decimals = _getDecimals(token);
        // Use Chain.currentTimestamp() instead of pythPrice.publishTime to support atomic actions
        // This is consistent with ChainlinkPriceFeedProvider behavior
        return
            OracleUtils.ValidatedPrice({
                token: token,
                min: (scaledPriceUint - scaledConfUint) / (10 ** decimals),
                max: (scaledPriceUint + scaledConfUint) / (10 ** decimals),
                timestamp: Chain.currentTimestamp(),
                provider: address(this)
            });
    }

    function _getDecimals(address token) internal returns (uint8) {
        uint8 decimals = cacheDecimals[token];
        if (decimals == 0) {
            decimals = IERC20Metadata(token).decimals();
            cacheDecimals[token] = decimals;
        }
        return decimals;
    }

    /// @notice Converts a Pyth price value to the target decimals
    /// @dev Validates that price is non-negative and exponent is in valid range [-18, 18]
    /// @param _price The Pyth price value (int64)
    /// @param _expo The Pyth price exponent (int32)
    /// @return The converted price value scaled to the target decimals
    function _convertPythPrice(int64 _price, int32 _expo) internal pure returns (uint256) {
        if (_price < 0 || _expo < -18 || _expo > 18) {
            revert Errors.PythPriceFeedProviderInvalidPrice(_price, _expo);
        }
        return _convertPythValue(uint64(_price), _expo);
    }

    /// @notice Converts a Pyth value (price or confidence) to the target decimals
    /// @dev Handles both positive and negative exponents. For positive exponents, scales up.
    ///      For negative exponents, scales to decimals first then divides by 10^(-expo).
    /// @param _value The Pyth value to convert (uint64)
    /// @param _expo The Pyth exponent (int32, must be in range [-18, 18])
    /// @return The converted value scaled to the target decimals
    function _convertPythValue(uint64 _value, int32 _expo) internal pure returns (uint256) {
        uint256 dominator = 10 ** (DECIMALS);
        if (_expo < -18 || _expo > 18) {
            revert Errors.PythPriceFeedProviderInvalidScale(_expo);
        }
        uint256 value = uint256(_value);
        if (_expo >= 0) {
            return value * (10 ** uint32(_expo)) * (10 ** (DECIMALS - uint32(_expo)));
        } else {
            uint256 absExpo = uint256(uint32(-_expo));
            uint256 scaled = value * dominator; // scale to decimals first
            return scaled / (10 ** absExpo); // divide by 10^(-expo)
        }
    }
}
