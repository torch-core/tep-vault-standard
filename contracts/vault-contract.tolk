/**
 * TEP-4626: Tokenized Vault Standard for TON Blockchain
 *
 * Implementation of the TEP-4626 "Tokenized Vault Standard" as defined in the TEP proposal.
 * This vault contract extends TEP-74 Jetton functionality to provide standardized deposit/withdrawal
 * operations for both TON and Jetton assets, issuing proportional shares as TEP-74 tokens.
 * Based on ERC-4626 design principles with TON blockchain adaptations.
 *
 * Key Features:
 * - Supports both TON and Jetton as underlying assets
 * - ERC-4626-like share/asset conversion with TON-specific adaptations
 * - Notification system with callbacks for DeFi composability
 * - Slippage protection via minShares/minWithdraw parameters
 * - Standardized gas estimation and quote mechanisms
 *
 * Security Considerations:
 * - Donation attack prevention: Only valid payloads affect vault state
 * - Admin security: Compromised admin can upgrade contract code to send malicious notifications to interacting protocols.
 *   Recommend using multisig, timelocks, or guardian roles to protect admin privileges.
 *
 * @dev This contract implements the main message routing for vault operations.
 *      Core logic is separated into dedicated modules (core.tolk, storage.tolk, etc.)
 */

import "constants/errors";
import "types/asset"
import "storage"
import "helper/jetton"
import "messages/schemas/deploy"
import "messages/schemas/deposit"
import "messages/schemas/withdraw"
import "messages/schemas/provide-take-quote"
import "messages/allowed"
import "messages/send"
import "messages/emit"
import "core";
import "fees-management";
import "get-methods";

fun onInternalMessage(in: InMessage) {
    val inMsg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy VaultStorage.load();

    match (inMsg) {
        // Processes TON deposits and mints shares to receiver
        Deposit => {
            assert (inMsg.depositAmount > 0) throw ERR_INVALID_DEPOSIT_AMOUNT;

            // in.valueCoins must > deposit amount + deposit gas
            val remainingValue = processTonDepositGas(in.valueCoins, inMsg.depositAmount);
            val shares = handleDeposit(in.senderAddress, inMsg.queryId, remainingValue, in.senderAddress, inMsg.depositAmount, inMsg.depositParams, in.body);

            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + inMsg.depositAmount;
            storage.save();
        }

        // Processes Jetton deposits and mints shares to receiver
        TransferNotificationForRecipient => {
            // Verifies sender is from vault's Jetton wallet to prevent unauthorized Jetton deposits  
            var externalAssetInfo = storage.externalAssetInfo!.load();
            assert (externalAssetInfo is JettonInfo) throw ERR_NON_SUPPORTED_JETTON_DEPSIT;
            assert (in.senderAddress == externalAssetInfo.walletAddress!) throw ERR_INVALID_JETTON_WALLET;

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

        // Processes share burns for withdrawals and withdraws asset to receiver
        BurnNotificationForMinter => {
            // Verifies sender is from initiator's share jetton wallet to prevent unauthorized burns
            assert (in.senderAddress.isAddressOfJettonWallet(inMsg.initiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;

            assert (inMsg.shares > 0) throw ERR_INVALID_BURN_AMOUNT;
            assert (inMsg.customPayload != null) throw ERR_MISSING_CUSTOM_PAYLOAD;
            val burnPayload = inMsg.customPayload!.load();
            
            match (burnPayload) {
                WithdrawFp => {
                    // in.valueCoins must > withdraw gas
                    val remainingValue = processWithdrawGas(in.valueCoins);

                    // If assetJettonInfo is null -> withdraw asset is TON, otherwise withdraw asset is Jetton
                    var externalAssetInfo = storage.externalAssetInfo!.load();
                    val assetJettonWallet = (externalAssetInfo is JettonInfo) ? externalAssetInfo.walletAddress! : null;
                    val withdrawAmount = handleWithdraw(inMsg.initiator, inMsg.queryId, remainingValue, inMsg.shares, burnPayload, in.body, assetJettonWallet);

                    storage.totalSupply = storage.totalSupply - inMsg.shares; 
                    storage.totalAssets = storage.totalAssets - withdrawAmount;
                    storage.save();
                }
            }
        }

        // Processes provide quote requests and sends take quote response to receiver
        ProvideQuote => {
            // in.valueCoins must > provide quote gas
            val remainingValue = processProvideQuoteGas(in.valueCoins);
            var quoteAsset: Asset = Asset.tonAsset();   
            if(storage.externalAssetInfo != null) {
                var externalAssetInfo = storage.externalAssetInfo!.load();
                if(externalAssetInfo is JettonInfo) {
                    quoteAsset = Asset.jettonAsset(externalAssetInfo.masterAddress!);
                }
                else {
                    quoteAsset = Asset.extraCurrencyAsset(externalAssetInfo.extraCurrencyId!);
                }
            }

            sendTakeQuote(in.senderAddress, inMsg.queryId, remainingValue, quoteAsset, inMsg.receiver, storage.totalSupply, totalAssets(), inMsg.forwardPayload);

            emitQuoted(Quoted {
                quoteAsset: quoteAsset.toCell(),
                initiator: in.senderAddress,
                receiver: inMsg.receiver,
                totalSupply: storage.totalSupply,
                totalAssets: storage.totalAssets,
                timestamp: blockchain.now()
            });
        }

        // Updates Vault's jetton wallet address from Jetton master response
        ResponseWalletAddress => {
            var externalAssetInfo = storage.externalAssetInfo!.load();

            // Verifies sender is from Jetton master to prevent unauthorized updates
            if(externalAssetInfo is JettonInfo) {
                assert (in.senderAddress == externalAssetInfo.masterAddress!) throw ERR_INVALID_JETTON_WALLET; 
                externalAssetInfo.walletAddress = inMsg.jettonWalletAddress;
            }
            storage.externalAssetInfo = externalAssetInfo.toCell();
            storage.save();
        }

        DeployVault => {
            // If assetJettonInfo is not null -> underlying asset is Jetton, otherwise underlying asset is TON
            var externalAssetInfo = storage.externalAssetInfo!.load();
            if(externalAssetInfo is JettonInfo) { 
                // Only admin can deploy Jetton vault
                assert (in.senderAddress == storage.adminAddress) throw ERR_UNAUTHORIZED_ADMIN;
                
                // Send request wallet address to Jetton master
                sendRequestWalletAddress(externalAssetInfo.masterAddress!, inMsg.queryId);
            }
        }

        else => {
            // ignore empty messages, throw ERR_INVALID_OPCODE for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {}
