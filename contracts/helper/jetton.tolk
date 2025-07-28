import "../constants/values";
import "../messages/internal/schemas";

struct WalletStorage {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

@pure
fun calcDeployedJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell): AutoDeployAddress {
    val emptyWalletStorage: WalletStorage = {
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
