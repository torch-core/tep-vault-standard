
import "@stdlib/tvm-dicts";
import "../constants/errors";
import "../role-authority/constants/size";

fun getJettonMasterFromWallet(jettonInfos: dict, jettonWallet: address) {
    var (jettonMasterEntry: slice?, found: bool) = jettonInfos.sDictGet(ADDRESS_SIZE, jettonWallet as slice);
    assert (found) throw ERR_JETTON_MASTER_NOT_FOUND;
    val jettonMaster = jettonMasterEntry!.loadAddress();
    return jettonMaster;
}