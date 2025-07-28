import "../types/callback-params";
import "../messages/internal/schemas";

@pure
fun fillDefaultCallbacks(callbacks: VaultCallbacks, defaultSuccess: CallbackParams, defaultFailure: CallbackParams) {
    return VaultCallbacks {
        successCallback: callbacks.successCallback == null ? defaultSuccess : callbacks.successCallback,
        failureCallback: callbacks.failureCallback == null ? defaultFailure : callbacks.failureCallback,
    };
}

@pure
fun fillDefaultReceiver(receiver: address?, initiator: address) {
    return receiver == null ? initiator : receiver;
}

@pure
fun fillDefaultMinAmount(minAmount: coins?, defaultMinAmount: coins) {
    return minAmount == null ? defaultMinAmount : minAmount;
}

@pure
fun fillDefaultDepositParams(depositParams: VaultDepositParams?, initiator: address) {
    if (depositParams == null) {
        return VaultDepositParams {
            receiver: initiator,
            minShares: 0,
            optionalVaultParams: null,
            vaultCallbacks: VaultCallbacks {
                successCallback: CallbackParams.defaultSuccessDeposit(),
                failureCallback: CallbackParams.defaultFailureDeposit(),
            },
        };
    }
    
    return VaultDepositParams {
        receiver: fillDefaultReceiver(depositParams.receiver, initiator),
        minShares: fillDefaultMinAmount(depositParams.minShares, 0 as coins),
        optionalVaultParams: depositParams.optionalVaultParams,
        vaultCallbacks: fillDefaultCallbacks(
            depositParams.vaultCallbacks,
            CallbackParams.defaultSuccessDeposit(),
            CallbackParams.defaultFailureDeposit()
        ),
    };
}

@pure
fun fillDefaultWithdrawParams(withdrawParams: VaultWithdrawFp?, initiator: address) {
    if (withdrawParams == null) {
        return VaultWithdrawFp {
            receiver: initiator,
            minWithdraw: 0,
            optionalVaultParams: null,
            vaultCallbacks: VaultCallbacks {
                successCallback: CallbackParams.defaultSuccessWithdraw(),
                failureCallback: CallbackParams.defaultFailureWithdraw(),
            },
        };
    }

    return VaultWithdrawFp {
        receiver: fillDefaultReceiver(withdrawParams.receiver, initiator),
        minWithdraw: fillDefaultMinAmount(withdrawParams.minWithdraw, 0 as coins),
        optionalVaultParams: withdrawParams.optionalVaultParams,
        vaultCallbacks: fillDefaultCallbacks(
            withdrawParams.vaultCallbacks,
            CallbackParams.defaultSuccessWithdraw(),
            CallbackParams.defaultFailureWithdraw()
        ),
    };
}