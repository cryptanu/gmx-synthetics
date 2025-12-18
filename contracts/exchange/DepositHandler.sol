// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./BaseHandler.sol";

import "../market/Market.sol";
import "../market/MarketToken.sol";

import "../deposit/Deposit.sol";
import "../deposit/DepositVault.sol";
import "../deposit/DepositUtils.sol";
import "../deposit/ExecuteDepositUtils.sol";

import "./IDepositHandler.sol";

// @title DepositHandler
// @dev Contract to handle creation, execution and cancellation of deposits
contract DepositHandler is IDepositHandler, BaseHandler {
    using Deposit for Deposit.Props;

    DepositVault public immutable depositVault;

    constructor(
        RoleStore _roleStore,
        DataStore _dataStore,
        EventEmitter _eventEmitter,
        Oracle _oracle,
        DepositVault _depositVault
    ) BaseHandler(_roleStore, _dataStore, _eventEmitter, _oracle) {
        depositVault = _depositVault;
    }

    // @dev creates a deposit in the deposit store
    // @param account the depositing account
    // @param params DepositUtils.CreateDepositParams
    function createDeposit(
        address account,
        DepositUtils.CreateDepositParams calldata params
    ) external override globalNonReentrant onlyController returns (bytes32) {
        FeatureUtils.validateFeature(dataStore, Keys.createDepositFeatureDisabledKey(address(this)));

        return DepositUtils.createDeposit(
            dataStore,
            eventEmitter,
            depositVault,
            account,
            params,
            false // isAtomicDeposit
        );
    }

    // @dev cancels a deposit
    // @param key the deposit key
    function cancelDeposit(bytes32 key) external override globalNonReentrant onlyController {
        uint256 startingGas = gasleft();

        DataStore _dataStore = dataStore;
        Deposit.Props memory deposit = DepositStoreUtils.get(_dataStore, key);

        FeatureUtils.validateFeature(_dataStore, Keys.cancelDepositFeatureDisabledKey(address(this)));

        validateRequestCancellation(
            deposit.updatedAtTime(),
            "Deposit"
        );

        DepositUtils.cancelDeposit(
            _dataStore,
            eventEmitter,
            depositVault,
            key,
            deposit.account(),
            startingGas,
            Keys.USER_INITIATED_CANCEL,
            ""
        );
    }

    // @dev executes a deposit
    // @param key the key of the deposit to execute
    // @param oracleParams OracleUtils.SetPricesParams
    function executeDeposit(
        bytes32 key,
        OracleUtils.SetPricesParams calldata oracleParams
    ) external
        globalNonReentrant
        onlyOrderKeeper
        withOraclePrices(oracleParams)
    {
        uint256 startingGas = gasleft();

        Deposit.Props memory deposit = DepositStoreUtils.get(dataStore, key);
        uint256 estimatedGasLimit = GasUtils.estimateExecuteDepositGasLimit(dataStore, deposit);
        GasUtils.validateExecutionGas(dataStore, startingGas, estimatedGasLimit);

        uint256 executionGas = GasUtils.getExecutionGas(dataStore, startingGas);

        try this._executeDeposit{ gas: executionGas }(
            key,
            deposit,
            msg.sender,
            ISwapPricingUtils.SwapPricingType.TwoStep
        ) {
        } catch (bytes memory reasonBytes) {
            _handleDepositError(
                key,
                startingGas,
                reasonBytes
            );
        }
    }

    // @dev simulate execution of a deposit to check for any errors
    // @param key the deposit key
    // @param params OracleUtils.SimulatePricesParams
    // @param swapPricingType the swap pricing type (TwoStep or Atomic)
    function simulateExecuteDeposit(
        bytes32 key,
        OracleUtils.SimulatePricesParams memory params,
        ISwapPricingUtils.SwapPricingType swapPricingType
    ) external
        override
        onlyController
        withSimulatedOraclePrices(params)
        globalNonReentrant
    {
        Deposit.Props memory deposit = DepositStoreUtils.get(dataStore, key);

        this._executeDeposit(
            key,
            deposit,
            msg.sender,
            swapPricingType
        );
    }

    // @notice this function can only be called for markets where Chainlink
    // on-chain feeds are configured for all the tokens of the market
    // for example, if the market has index token as DOGE, long token as WETH
    // and short token as USDC, Chainlink on-chain feeds must be configured
    // for DOGE, WETH, USDC for this method to be callable for the market
    function executeAtomicDeposit(
        address account,
        DepositUtils.CreateDepositParams calldata params,
        OracleUtils.SetPricesParams calldata oracleParams
    )
        external
        globalNonReentrant
        onlyController
        withOraclePricesForAtomicAction(oracleParams)
    {
        FeatureUtils.validateFeature(dataStore, Keys.executeAtomicDepositFeatureDisabledKey(address(this)));

        oracle.validateSequencerUp();

        if (
            params.longTokenSwapPath.length != 0 ||
            params.shortTokenSwapPath.length != 0
        ) {
            revert Errors.SwapsNotAllowedForAtomicDeposit(
                params.longTokenSwapPath.length,
                params.shortTokenSwapPath.length
            );
        }

        bytes32 key = DepositUtils.createDeposit(
            dataStore,
            eventEmitter,
            depositVault,
            account,
            params,
            true // isAtomicDeposit
        );

        Deposit.Props memory deposit = DepositStoreUtils.get(dataStore, key);

        this._executeDeposit(
            key,
            deposit,
            account,
            ISwapPricingUtils.SwapPricingType.Atomic
        );
    }

    // @dev executes a deposit
    // @param key the deposit key
    // @param deposit the deposit to execute
    // @param keeper the keeper executing the deposit
    // @param swapPricingType the swap pricing type (TwoStep or Atomic)
    function _executeDeposit(
        bytes32 key,
        Deposit.Props memory deposit,
        address keeper,
        ISwapPricingUtils.SwapPricingType swapPricingType
    ) external onlySelf {
        uint256 startingGas = gasleft();

        FeatureUtils.validateFeature(dataStore, Keys.executeDepositFeatureDisabledKey(address(this)));

        ExecuteDepositUtils.ExecuteDepositParams memory params = ExecuteDepositUtils.ExecuteDepositParams(
            dataStore,
            eventEmitter,
            depositVault,
            oracle,
            key,
            keeper,
            startingGas,
            swapPricingType,
            true // includeVirtualInventoryImpact
        );

        ExecuteDepositUtils.executeDeposit(params, deposit);
    }

    // @dev handle errors from deposits
    // @param key the deposit key
    // @param startingGas the starting gas of the txn
    // @param reasonBytes the reason bytes of the error
    function _handleDepositError(
        bytes32 key,
        uint256 startingGas,
        bytes memory reasonBytes
    ) internal {
        GasUtils.validateExecutionErrorGas(dataStore, reasonBytes);

        bytes4 errorSelector = ErrorUtils.getErrorSelectorFromData(reasonBytes);

        validateNonKeeperError(errorSelector, reasonBytes);

        (string memory reason, /* bool hasRevertMessage */) = ErrorUtils.getRevertMessage(reasonBytes);

        DepositUtils.cancelDeposit(
            dataStore,
            eventEmitter,
            depositVault,
            key,
            msg.sender,
            startingGas,
            reason,
            reasonBytes
        );
    }
}
