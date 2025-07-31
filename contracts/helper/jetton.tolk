import "../constants/values";
import "../storage"
import "../types/callback-params"

@pure
fun calcDeployedJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell): AutoDeployAddress {
    val emptyWalletStorage: WalletStorage = {
        status: 0,
        jettonBalance: 0,
        ownerAddress,
        minterAddress,
    };

    return {
        stateInit: {
            code: jettonWalletCode,
            data: emptyWalletStorage.toCell()
        }
    }
}

@pure
fun calcForwardTonAmount(callbackParams: Cell<CallbackParams>?, sendingValue: coins) {
    return (callbackParams == null ? DEFAULT_JETTON_NOTIFICATION_FEE : sendingValue - JETTON_TRANSFER_FEE) as coins;
}

fun buildAddressOfJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell) {
    val jwDeployed = calcDeployedJettonWallet(ownerAddress, minterAddress, jettonWalletCode);
    return jwDeployed.buildAddress()
}

@pure
fun address.isAddressOfJettonWallet(self, initiator: address, minterAddress: address, jettonWalletCode: cell) {
    val jwDeployed = calcDeployedJettonWallet(initiator, minterAddress, jettonWalletCode);
    return jwDeployed.addressMatches(self)
}
