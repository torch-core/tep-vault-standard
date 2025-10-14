/**
 * TEP-524: Tokenized Vault Standard for TON Blockchain
 *
 * Implementation of the TEP-524 "Tokenized Vault Standard" as defined in the TEP proposal.
 * This vault contract extends TEP-74 Jetton functionality to provide standardized deposit/withdrawal
 * operations for TON, Jetton and Extra Currency assets, issuing proportional shares as TEP-74 tokens.
 * Based on ERC-4626 design principles with TON blockchain adaptations.
 *
 * Key Features:
 * - Supports TON, Jetton and Extra Currency as underlying assets
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
import "constants/values"
import "types/asset"
import "storage"
import "helper/jetton"
import "helper/extra-currency"
import "messages/schemas/common"
import "messages/allowed"
import "messages/schemas/deploy"
import "messages/schemas/deposit"
import "messages/schemas/withdraw"
import "messages/schemas/provide-take-quote"
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
            // Prevent TON deposits in Jetton/Extra Currency vaults
            assert (storage.externalAssetInfo == null) throw ERR_UNSUPPORTED_TON_DEPOSIT;

            assert (inMsg.depositAmount > ZERO_COINS) throw ERR_INVALID_DEPOSIT_AMOUNT;

            // Prevent underpayment by ensuring in.valueCoins covers depositAmount + gas for complete execution
            val remainingValue = chargeTonDepositGas(in.valueCoins, inMsg.depositAmount);
            val txContext = TxContext { initiator: in.senderAddress, queryId: inMsg.queryId, remainingValue: remainingValue, inBody: in.body };

            val depositAsset = Asset.tonAsset();
            val shares = handleDeposit(txContext, depositAsset, inMsg.depositAmount, inMsg.depositParams, storage.vaultState);

            storage.updateSupplyAndAssets(shares, inMsg.depositAmount);
        }

        // Processes Extra Currency deposits and mints shares to receiver
        DepositEc => {
            // Prevent Extra Currency deposits in TON/Jetton vaults
            val extraCurrencyInfo = storage.mustGetExtraCurrencyInfo();

            // Prevent unsupported Extra Currency ID and multiple currency deposits
            val extraCurrencyId = extraCurrencyInfo.extraCurrencyId;
            val depositAmount = extractSingleEcAmount(in.valueExtra, extraCurrencyId);

            val remainingValue = chargeExtraCurrencyDepositGas(in.valueCoins);    
            val txContext = TxContext { initiator: in.senderAddress, queryId: inMsg.queryId, remainingValue: remainingValue, inBody: in.body };

            val depositAsset = Asset.extraCurrencyAsset(extraCurrencyId);
            val shares = handleDeposit(txContext, depositAsset, depositAmount, inMsg.depositParams, storage.vaultState);

            storage.updateSupplyAndAssets(shares, depositAmount);
        }

        // Processes Jetton deposits and mints shares to receiver
        VaultTransferNotification => {
            // Prevent Jetton deposits in TON/Extra Currency vaults
            val assetJettonInfo = storage.mustGetJettonInfo();

            // Prevent Jetton deposits from wallets other than vault's underlying Jetton wallet 
            assert (in.senderAddress == assetJettonInfo.walletAddress) throw ERR_INVALID_JETTON_WALLET;

            assert (inMsg.depositAmount > ZERO_COINS) throw ERR_INVALID_DEPOSIT_AMOUNT;
            assert (inMsg.forwardPayload != null) throw ERR_MISSING_FORWARD_PAYLOAD;
        
            match (inMsg.forwardPayload) {
                Cell<DepositFp> => {
                    val remainingValue = chargeJettonDepositGas(in.valueCoins);
                    val txContext = TxContext { initiator: inMsg.initiator, queryId: inMsg.queryId, remainingValue: remainingValue, inBody: in.body };

                    val depositAsset = Asset.jettonAsset(assetJettonInfo.masterAddress);
                    val depositParams = inMsg.forwardPayload.load().depositParams;
                    val shares = handleDeposit(txContext, depositAsset, inMsg.depositAmount, depositParams, storage.vaultState, assetJettonInfo.walletAddress);

                    storage.updateSupplyAndAssets(shares, inMsg.depositAmount);
                }
            }
        }

        // Processes share burns for withdrawals and withdraws asset to receiver
        VaultBurnNotification => {
            // Prevent share burns from wallets other than initiator's vault share Jetton wallet
            assert (in.senderAddress.isAddressOfJettonWallet(inMsg.initiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;

            assert (inMsg.shares > ZERO_COINS) throw ERR_INVALID_BURN_AMOUNT;
            assert (inMsg.customPayload != null) throw ERR_MISSING_CUSTOM_PAYLOAD;
            
            match (inMsg.customPayload) {
                Cell<WithdrawFp> => {
                    val remainingValue = chargeWithdrawGas(in.valueCoins);
                    val txContext = TxContext { initiator: inMsg.initiator, queryId: inMsg.queryId, remainingValue: remainingValue, inBody: in.body };

                    val withdrawAsset = storage.getAsset();
                    val withdrawFp = inMsg.customPayload.load();
                    val assetJettonWallet = (withdrawAsset is JettonAsset) ? storage.mustGetJettonInfo().walletAddress : null;
                    val withdrawAmount = handleWithdraw(txContext, withdrawAsset, inMsg.shares, withdrawFp, storage.vaultState, assetJettonWallet);

                    storage.updateSupplyAndAssets(-inMsg.shares, -withdrawAmount);
                }
            }
        }

        // Processes provide quote requests and sends take quote response to receiver
        ProvideQuote => {
            val remainingValue = chargeProvideQuoteGas(in.valueCoins);
            val txContext = TxContext { initiator: in.senderAddress, queryId: inMsg.queryId, remainingValue: remainingValue, inBody: "" };
            
            val normalizedTotalAssets = totalAssets();
            sendTakeQuote(txContext, inMsg.receiver, storage.vaultState.totalSupply, normalizedTotalAssets, inMsg.forwardPayload);

            emitQuoted(Quoted {
                quoteAsset: storage.getAsset().toCell(),
                initiator: txContext.initiator,
                receiver: inMsg.receiver,
                totalSupply: storage.vaultState.totalSupply,
                normalizedTotalAssets: normalizedTotalAssets,
                timestamp: blockchain.now()
            });
        }

        // Updates Vault's Jetton wallet address from Jetton master response
        ResponseWalletAddress => {
            storage.setJettonWalletAddress(in.senderAddress, inMsg.jettonWalletAddress);
        }

        DeployVault => {
            if (storage.externalAssetInfo == null) { return; }

            // If externalAssetInfo is not null and is JettonInfo, then underlying asset is Jetton. Otherwise, underlying asset is TON or Extra Currency
            var externalAssetInfo = storage.externalAssetInfo.load();
            if (!(externalAssetInfo is JettonInfo)) { return; }

            // Only admin can deploy Jetton vault to prevent unauthorized Jetton vault deployment   
            assert (in.senderAddress == storage.adminAddress) throw ERR_UNAUTHORIZED_ADMIN;
            
            // Send request wallet address to Jetton master
            sendRequestWalletAddress(externalAssetInfo.masterAddress!, inMsg.queryId);
        }

        else => {
            // ignore empty messages, throw ERR_INVALID_OPCODE for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}
