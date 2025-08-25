struct (0x0000) TonAsset {
    // assetType: uint4 = 0;
}

struct (0x0001) JettonAsset {
    // assetType: AssetType = ASSET_TYPE_JETTON;
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
