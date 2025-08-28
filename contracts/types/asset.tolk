import "../constants/common-types"

struct (0x0) TonAsset {}

struct (0x1) JettonAsset {
    jettonMaster: address;
}

struct (0x2) ExtraCurrencyAsset {
    extraCurrencyId: ExtraCurrencyId;
}

type Asset = TonAsset | JettonAsset | ExtraCurrencyAsset;

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

@pure
fun Asset.extraCurrencyAsset(extraCurrencyId: ExtraCurrencyId) {
    return ExtraCurrencyAsset {
        extraCurrencyId: extraCurrencyId,
    };
}