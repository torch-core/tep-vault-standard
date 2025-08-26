import "../../constants/common-types"
import "../../types/asset"
import "common"

struct QuoteOptions {
    vaultOptions: Cell<VaultOptions>? = null
}

struct (0xc643cc91) ProvideQuote {
    queryId: QueryId
    quoteAsset: Cell<Asset>? = null
    receiver: address
    quoteOptions: Cell<QuoteOptions>? = null
    forwardPayload: cell?
}

struct (0x68ec31ea) TakeQuote {
    queryId: QueryId
    initiator: address
    quoteAsset: Cell<Asset>
    totalSupply: coins
    totalAssets: coins
    timestamp: Timestamp
    forwardPayload: cell?
}

// Logs
struct (0xb7bfa697) Quoted {
    quoteAsset: Cell<Asset>
    initiator: address
    receiver: address
    totalSupply: coins
    totalAssets: coins
    timestamp: Timestamp
}

const TOPIC_QUOTED = Quoted.getDeclaredPackPrefix();