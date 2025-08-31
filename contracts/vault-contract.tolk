/**
 * TEP-4626: Tokenized Vault Standard for TON Blockchain
 *
 * Implementation of the TEP-4626 "Tokenized Vault Standard" as defined in the TEP proposal.
 * This vault contract extends TEP-74 Jetton functionality to provide standardized deposit/withdrawal
 * operations for TON, Jetton and Extra currency assets, issuing proportional shares as TEP-74 tokens.
 * Based on ERC-4626 design principles with TON blockchain adaptations.
 *
 * Key Features:
 * - Supports TON, Jetton and Extra currency as underlying assets
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
import "helper/extra-currency"
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
            // Verifies vault is supported TON deposit to prevent unauthorized TON deposits
            assert (storage.externalAssetInfo == null) throw ERR_NON_SUPPORTED_TON_DEPOSIT;

            assert (inMsg.depositAmount > 0) throw ERR_INVALID_DEPOSIT_AMOUNT;

            // in.valueCoins must > deposit amount + deposit gas
            val remainingValue = processTonDepositGas(in.valueCoins, inMsg.depositAmount);

            val depositAsset = Asset.tonAsset();
            val shares = handleDeposit(depositAsset, in.senderAddress, inMsg.queryId, remainingValue, inMsg.depositAmount, inMsg.depositParams, in.body);

            storage.updateSupplyAndAssets(shares, inMsg.depositAmount);
        }

        // Processes Extra currency deposits and mints shares to receiver
        DepositEc => {
            // Verifies vault is supported Extra currency deposit to prevent unauthorized Extra currency deposits
            val extraCurrencyInfo = storage.getExtraCurrencyInfo();
            assert (extraCurrencyInfo != null) throw ERR_NON_SUPPORTED_EXTRA_CURRENCY_DEPOSIT;

            // Validates Extra Currency deposit to prevent unauthorized deposits and multiple Extra Currency deposits in single-asset vaults
            val extraCurrencyId = extraCurrencyInfo.extraCurrencyId!;
            val depositAmount = getSingleEcAmount(in.valueExtra, extraCurrencyId);

            val remainingValue = processExtraCurrencyDepositGas(in.valueCoins);    

            val depositAsset = Asset.extraCurrencyAsset(extraCurrencyId);
            val shares = handleDeposit(depositAsset, in.senderAddress, inMsg.queryId, remainingValue, depositAmount, inMsg.depositParams, in.body);

            storage.updateSupplyAndAssets(shares, depositAmount);
        }

        // Processes Jetton deposits and mints shares to receiver
        VaultTransferNotification => {
            // Verifies vault is supported Jetton deposit to prevent unauthorized Jetton deposits
            val assetJettonInfo = storage.getAssetJettonInfo();
            assert (assetJettonInfo != null) throw ERR_NON_SUPPORTED_JETTON_DEPSIT;

            // Verifies sender is from vault's underlying Jetton wallet to prevent unauthorized Jetton asset deposits  
            assert (in.senderAddress == assetJettonInfo.walletAddress) throw ERR_INVALID_JETTON_WALLET;

            assert (inMsg.depositAmount > 0) throw ERR_INVALID_DEPOSIT_AMOUNT;
            assert (inMsg.forwardPayload != null) throw ERR_MISSING_FORWARD_PAYLOAD;
        
            match (inMsg.forwardPayload) {
                Cell<DepositFp> => {
                    // in.valueCoins must > deposit gas
                    val remainingValue = processJettonDepositGas(in.valueCoins);

                    val depositAsset = Asset.jettonAsset(assetJettonInfo.masterAddress!);
                    val depositParams = inMsg.forwardPayload.load().depositParams;
                    val shares = handleDeposit(depositAsset, inMsg.initiator, inMsg.queryId, remainingValue, inMsg.depositAmount, depositParams, in.body);

                    storage.updateSupplyAndAssets(shares, inMsg.depositAmount);
                }
            }
        }

        // Processes share burns for withdrawals and withdraws asset to receiver
        VaultBurnNotification => {
            // Verifies sender is from initiator's share Jetton wallet to prevent unauthorized burns
            assert (in.senderAddress.isAddressOfJettonWallet(inMsg.initiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;

            assert (inMsg.shares > 0) throw ERR_INVALID_BURN_AMOUNT;
            assert (inMsg.customPayload != null) throw ERR_MISSING_CUSTOM_PAYLOAD;
            
            match (inMsg.customPayload) {
                Cell<WithdrawFp> => {
                    // in.valueCoins must > withdraw gas
                    val remainingValue = processWithdrawGas(in.valueCoins);

                    val withdrawAsset = storage.getAsset();
                    val withdrawFp = inMsg.customPayload.load();
                    val withdrawAmount = handleWithdraw(withdrawAsset, inMsg.initiator, inMsg.queryId, remainingValue, inMsg.shares, withdrawFp, in.body);

                    storage.updateSupplyAndAssets(-inMsg.shares, -withdrawAmount);
                }
            }
        }

        // Processes provide quote requests and sends take quote response to receiver
        ProvideQuote => {
            // in.valueCoins must > provide quote gas
            val remainingValue = processProvideQuoteGas(in.valueCoins);
            
            var quoteAsset: Asset = storage.getAsset();
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

        // Updates Vault's Jetton wallet address from Jetton master response
        ResponseWalletAddress => {
            storage.SetJettonWalletAddress(in.senderAddress, inMsg.jettonWalletAddress);
        }

        DeployVault => {
            // If assetJettonInfo is not null -> underlying asset is Jetton, otherwise underlying asset is TON or Extra currency
            if (storage.externalAssetInfo != null) {
                var externalAssetInfo = storage.externalAssetInfo.load();
                if (externalAssetInfo is JettonInfo) { 
                    // Only admin can deploy Jetton vault to prevent unauthorized Jetton vault deployment   
                    assert (in.senderAddress == storage.adminAddress) throw ERR_UNAUTHORIZED_ADMIN;
                    
                    // Send request wallet address to Jetton master
                    sendRequestWalletAddress(externalAssetInfo.masterAddress!, inMsg.queryId);
                }
            }
        }

        else => {
            // ignore empty messages, throw ERR_INVALID_OPCODE for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {}
