struct (0x0000) TonAsset {
}

struct (0x0001) JettonAsset {
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
