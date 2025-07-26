type AssetType = uint4;

struct TonAsset {
    assetType: AssetType = 0;
}

struct JettonAsset {
    assetType: AssetType = 1;
    jettonMaster: address;
}

type Asset = TonAsset | JettonAsset;

fun Asset.tonAsset() {
    return TonAsset {};
}

fun Asset.jettonAsset(jettonMaster: address) {
    return JettonAsset {
        jettonMaster: jettonMaster,
    };
}
