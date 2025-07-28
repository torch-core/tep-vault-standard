import "../constants/values";
import "../storage"
import "../messages/internal/schemas";

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
fun calcForwardTonAmount(forwardPayload: Cell<VaultNotificationFp>?, sendingValue: coins) {
    return (forwardPayload == null ? 0 : sendingValue - JETTON_TRANSFER_FEE) as coins;
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
