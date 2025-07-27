import "../constants/values";
import "../messages/internal/schemas";

struct WalletStorage {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

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

fun calcForwardTonAmount(forwardPayload: Cell<VaultNotificationFp>?, sendingValue: coins) {
    return (forwardPayload == null ? 0 : sendingValue - JETTON_TRANSFER_FEE) as coins;
}