import "constants/errors";
import "storage"
import "helper/jetton"
import "messages/internal/schemas"
import "messages/internal/send"
import "core";
import "fees-management";
import "get-methods";

fun onInternalMessage(in: InMessage) {
    val inMsg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy VaultStorage.load();

    match (inMsg) {
        Deposit => {
            assert (inMsg.depositAmount > 0) throw ERR_INVALID_DEPOSIT_AMOUNT;

            // in.valueCoins must > deposit amount + deposit gas
            val remainingValue = processTonDepositGas(in.valueCoins, inMsg.depositAmount);
            val shares = handleDeposit(in.senderAddress, inMsg.queryId, remainingValue, in.senderAddress, inMsg.depositAmount, inMsg.depositParams, in.body);

            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + inMsg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            // Sender must be the vault's deposit asset jetton wallet
            var assetJettonInfo = lazy storage.assetJettonInfo!.load();
            assert (in.senderAddress == assetJettonInfo.walletAddress!) throw ERR_INVALID_JETTON_WALLET;

            assert (inMsg.depositAmount > 0) throw ERR_INVALID_DEPOSIT_AMOUNT;
            assert (inMsg.forwardPayload != null) throw ERR_MISSING_FORWARD_PAYLOAD;
            val forwardPayload = inMsg.forwardPayload!.load();

            match (forwardPayload) {
                DepositFp => {
                    // in.valueCoins must > deposit gas
                    val remainingValue = processJettonDepositGas(in.valueCoins);
                    val shares = handleDeposit(inMsg.initiator, inMsg.queryId, remainingValue, in.senderAddress, inMsg.depositAmount, forwardPayload.depositParams, in.body);

                    storage.totalSupply = storage.totalSupply + shares;
                    storage.totalAssets = storage.totalAssets + inMsg.depositAmount;
                    storage.save();
                }
            }
        }

        BurnNotificationForMinter => {
            // Sender must be the initiator's share jetton wallet
            assert (in.senderAddress.isAddressOfJettonWallet(inMsg.initiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;

            assert (inMsg.shares > 0) throw ERR_INVALID_BURN_AMOUNT;
            assert (inMsg.customPayload != null) throw ERR_MISSING_CUSTOM_PAYLOAD;
            val burnPayload = inMsg.customPayload!.load();
            
            match (burnPayload) {
                WithdrawFp => {
                    // in.valueCoins must > withdraw gas
                    val remainingValue = processWithdrawGas(in.valueCoins);

                    // If assetJettonInfo is null -> withdraw asset is TON, otherwise withdraw asset is Jetton
                    val assetJettonWallet = storage.assetJettonInfo != null ? storage.assetJettonInfo!.load().walletAddress : null;
                    val withdrawAmount = handleWithdraw(inMsg.initiator, inMsg.queryId, remainingValue, inMsg.shares, burnPayload, in.body, assetJettonWallet);

                    storage.totalSupply = storage.totalSupply - inMsg.shares; 
                    storage.totalAssets = storage.totalAssets - withdrawAmount;
                    storage.save();
                }
            }
        }

        ProvideQuote => {
            // in.valueCoins must > provide quote gas
            val remainingValue = processProvideQuoteGas(in.valueCoins);
            sendTakeQuote(in.senderAddress, inMsg.queryId, remainingValue, inMsg.receiver, storage.totalSupply, totalAssets(), inMsg.forwardPayload);
        }

        ResponseWalletAddress => {
            var assetJettonInfo = lazy storage.assetJettonInfo!.load();
            assert (in.senderAddress == assetJettonInfo.masterAddress!) throw ERR_INVALID_JETTON_WALLET; 
            assetJettonInfo.walletAddress = inMsg.jettonWalletAddress;
            storage.assetJettonInfo = assetJettonInfo.toCell();
            storage.save();
        }

        DeployVault => {
            // If assetJettonInfo is not null -> underlying asset is Jetton, otherwise underlying asset is TON
            if(storage.assetJettonInfo != null) { 
                var assetJettonInfo = lazy storage.assetJettonInfo!.load();

                // Only admin can deploy Jetton vault
                assert (in.senderAddress == storage.adminAddress) throw ERR_UNAUTHORIZED_ADMIN;
                
                // Send request wallet address to Jetton master
                sendRequestWalletAddress(assetJettonInfo.masterAddress!, inMsg.queryId);
            }
        }

        else => {
            // ignore empty messages, throw ERR_INVALID_OPCODE for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {}
