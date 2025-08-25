struct (0x0) TonAsset {}

struct (0x1) JettonAsset {
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
