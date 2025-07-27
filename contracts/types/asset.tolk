type AssetType = uint4;

const ASSET_TYPE_TON = 0;
const ASSET_TYPE_JETTON = 1;

fun AssetType.ton() {
    return ASSET_TYPE_TON;
}

fun AssetType.jetton() {
    return ASSET_TYPE_JETTON;
}

struct TonAsset {
    assetType: AssetType = ASSET_TYPE_TON;
}

struct JettonAsset {
    assetType: AssetType = ASSET_TYPE_JETTON;
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
