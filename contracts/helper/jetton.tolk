
import "@stdlib/tvm-dicts";
import "../constants/errors";
import "../role-authority/constants/size";

struct WalletStorage {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

fun getJettonMasterFromWallet(jettonInfos: dict, jettonWallet: address) {
    var (jettonMasterEntry: slice?, found: bool) = jettonInfos.sDictGet(ADDRESS_SIZE, jettonWallet as slice);
    assert (found) throw ERR_JETTON_MASTER_NOT_FOUND;
    val jettonMaster = jettonMasterEntry!.loadAddress();
    return jettonMaster;
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