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
        receiver: depositParams.receiver == null ? initiator : depositParams.receiver,
        minShares: depositParams.minShares == null ? 0 as coins : depositParams.minShares,
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
        receiver: withdrawParams.receiver == null ? initiator : withdrawParams.receiver,
        minWithdraw: withdrawParams.minWithdraw == null ? 0 as coins : withdrawParams.minWithdraw,
        optionalVaultParams: withdrawParams.optionalVaultParams,
        vaultCallbacks: fillDefaultCallbacks(
            withdrawParams.vaultCallbacks,
            CallbackParams.defaultSuccessWithdraw(),
            CallbackParams.defaultFailureWithdraw()
        ),
    };
}