type AssetType = uint4;

struct TonAsset {
    assetType: AssetType = 0;
}

struct JettonAsset {
    assetType: AssetType = 1;
    jettonMaster: address;
}

type Asset = TonAsset | JettonAsset;

// Pack TON Asset
fun tonAsset() {
    return TonAsset {};
}

// Pack Jetton Asset
fun jettonAsset(jettonMaster: address) {
    return JettonAsset {
        jettonMaster: jettonMaster,
    };
}
