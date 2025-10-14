import "../constants/values"
import "../types/callback-params"
import "../types/asset"
import "../types/rounding"
import "../messages/schemas/common"
import "../messages/send"

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

struct (0xa2519c55) InvalidTransferAmount {
    queryId: uint64
}

struct (0xcf97c20f) MissingJettonWallet {
    queryId: uint64
}

struct (0x10ba9058) WrongRoundingType {
    queryId: uint64
}


// using unions to represent available messages
// this allows processing them with pattern matching
type AllowedMessage = InvalidTransferAmount | MissingJettonWallet | WrongRoundingType

// the main entrypoint: called when a contract receives an message from other contracts
fun onInternalMessage(in: InMessage) {
    // use `lazy` to defer loading fields until they are accessed
    val msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
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

        WrongRoundingType => {
            var storage = lazy Storage.load();

            /*
                Even if an invalid number is assigned to `roundingType` and forcibly converted using `as`, 
                Tolk will not throw an error when using `match` — instead, it will enter *undefined behavior (UB)*. 
                Therefore, extra caution is required when using it. 
                
                For a detailed explanation, please refer to:https://github.com/ton-blockchain/ton/issues/1839
             */

            // RoundingType can only be 0, 1, 2 but we're passing 5
            val wrongRoundingType = 5 as RoundingType;
            val a = 8;
            val b = 3;
            val c = 2;
            val result = roundedMulDiv(a, b, c, wrongRoundingType);

            storage.id = result;
            storage.save();
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}
