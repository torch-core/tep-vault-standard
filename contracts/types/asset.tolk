type AssetType = uint4;

const ASSET_TYPE_TON = 0;
const ASSET_TYPE_JETTON = 1;

@pure
fun AssetType.ton() {
    return ASSET_TYPE_TON;
}

@pure
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

@pure
fun Asset.tonAsset() {
    return TonAsset {};
}

@pure
fun Asset.jettonAsset(jettonMaster: address) {
    return JettonAsset {
        jettonMaster: jettonMaster,
    };
}
