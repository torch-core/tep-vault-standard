
import "@stdlib/tvm-dicts";
import "../constants/errors";
import "../constants/size";

struct WalletStorage {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

fun getJettonMasterFromWallet(walletToMaster: dict, jettonWallet: address) {
    var (jettonMasterEntry: slice?, found: bool) = walletToMaster.sDictGet(ADDRESS_SIZE, jettonWallet as slice);
    assert (found) throw ERR_JETTON_MASTER_NOT_FOUND;
    val jettonMaster = jettonMasterEntry!.loadAddress();
    return jettonMaster;
}

fun getJettonWalletFromMaster(masterToWallet: dict, jettonMaster: address) {
    var (jettonWalletEntry: slice?, found: bool) = masterToWallet.sDictGet(ADDRESS_SIZE, jettonMaster as slice);
    assert (found) throw ERR_JETTON_MASTER_NOT_FOUND;
    val jettonWallet = jettonWalletEntry!.loadAddress();
    return jettonWallet;
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