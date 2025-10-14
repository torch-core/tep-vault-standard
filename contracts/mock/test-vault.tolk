import "../types/asset"
import "../core"
import "../messages/schemas/common"
import "../messages/schemas/deposit"
import "../constants/values"
import "../messages/send"
import "../types/callback-params"

tolk 1.1

// this struct defines storage layout of the contract
struct Storage {
    id: uint32  // required to allow multiple independent counter instances, since the contract address depends on its initial state
    counter: uint32 // the current counter value
}

// load contract data from the persistent storage
fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

// save contract data into the persistent storage
fun Storage.save(self) {
    contract.setData(self.toCell())
}

// the struct uses a 32-bit opcode prefix for message identification
struct (0x7e8764ef) IncreaseCounter {
    queryId: uint64  // query id, typically included in messages
    increaseBy: uint32
}

struct (0xa2519c55) InvalidTransferAmount {
    queryId: uint64
}

struct (0xcf97c20f) MissingJettonWallet {
    queryId: uint64
}


// using unions to represent available messages
// this allows processing them with pattern matching
type AllowedMessage = IncreaseCounter | InvalidTransferAmount | MissingJettonWallet

// the main entrypoint: called when a contract receives an message from other contracts
fun onInternalMessage(in: InMessage) {
    // use `lazy` to defer loading fields until they are accessed
    val msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        IncreaseCounter => {
            // load contract storage lazily (efficient for large or partial reads/updates)
            var storage = lazy Storage.load();

            storage.counter += msg.increaseBy;
            storage.save();
        }

        InvalidTransferAmount => {
            val depositAsset = Asset.tonAsset();
            val txContext = TxContext { initiator: in.senderAddress, queryId: 0, remainingValue: ton("0.05"), inBody: in.body };
            
            transferAsset(TransferParams {
                asset: depositAsset,
                txContext: txContext, 
                transferAmount: 0, 
                receiver: txContext.initiator, 
                resultCode: SUCCESS_RESULT_CODE, 
                callbackParams: CallbackParams.defaultSuccess(), 
                assetJettonWallet: null,
            });  
        }

        MissingJettonWallet => {
            val depositAsset = Asset.jettonAsset(in.senderAddress);
            val txContext = TxContext { initiator: in.senderAddress, queryId: 0, remainingValue: ton("0.05"), inBody: in.body };
            
            transferAsset(TransferParams {
                asset: depositAsset,
                txContext: txContext, 
                transferAmount: 100, 
                receiver: txContext.initiator, 
                resultCode: SUCCESS_RESULT_CODE, 
                callbackParams: CallbackParams.defaultSuccess(), 
                assetJettonWallet: null,
            });  
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}
