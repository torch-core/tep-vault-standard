tolk 1.0

import "role-authority/auth";
import "role-authority/access";
import "role-authority/int-messages";
import "role-authority/ext-messages";
import "storage"
import "int-messages"
import "common/asset";
import "common/constants";
import "common/error";
import "common/math";

fun maxDeposit(depositAsset: Asset) {
    return MAX_COINS_VALUE;
}

fun convertToShares(depositedAmount: coins, rounding: RoundingType, depositAsset: Asset? = null) {
    var storage = lazy Storage.load();
    return roundedMulDiv(depositedAmount, storage.totalSupply, storage.totalAssets, rounding);
}

// depositAsset is for multi-asset vaults
fun previewDeposit(depositAmount: coins, depositAsset: Asset? = null) {
    return convertToShares(depositAmount, RoundingType.Down(), depositAsset);
}

fun mintShares(sender: address, receiver: address, shares: coins, callbackParams: CallbackParams?, msgPayload: cell) {
    // TODO: Implement minting
}

fun handleDeposit(sender: address, depositAmount: coins, depositParams: VaultDepositParams, msgPayload: cell, depositAsset: Asset) {
    try {
        val maxDepositAmount = maxDeposit(depositAsset);
        assert (depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

        val shares = previewDeposit(depositAmount, depositAsset);
        assert (shares >= depositParams.minMint) throw ERR_MIN_MINT_NOT_MET;

        mintShares(sender, depositParams.receiver, shares, depositParams.sucPayload, msgPayload);

        //TODO: Emit deposit event
        return shares;
    } catch (e) {
        // TODO Send error message to receiver with failPayload
        commitContractDataAndActions();
        throw e;
    }
}

// the main entrypoint: called when a contract receives an message from other contracts
fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy Storage.load();
    var auth = lazy storage.auth.load();

    match (msg) {
        VaultDeposit => {
            auth.requireAuth(in.senderAddress, OP_VAULT_DEPOSIT);
            // TODO: Check in.valueCoins >= deposit gas + deposit amount

            val shares = handleDeposit(in.senderAddress, msg.depositAmount, msg.vaultDepositParams, msg.toCell(), tonAsset());

            // Update storage
            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + msg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            auth.requireAuth(in.senderAddress, OP_TRANSFER_NOTIFICATION_FOR_RECIPIENT);
            // TODO: Check in.valueCoins >= deposit gas

            match (msg.forwardPayload) {
                VaultDepositFp => {
                    auth.requireAuth(in.senderAddress, OP_VAULT_DEPOSIT_FP);

                    val shares = handleDeposit(in.senderAddress, msg.jettonAmount, msg.forwardPayload.vaultDepositParams, msg.toCell(), tonAsset());

                    // Update storage
                    storage.totalSupply = storage.totalSupply + shares;
                    storage.totalAssets = storage.totalAssets + msg.jettonAmount;
                    storage.save();
                }
            }
        }

        /* Auth internal messages */
        SetPublicCapability => {
            auth.requireAuth(in.senderAddress, OP_SET_PUBLIC_CAPABILITY);
            storage.auth = auth.setPublicCapability(msg.opcode, msg.enabled);
            storage.save();
        }
        SetRoleCapability => {
            auth.requireAuth(in.senderAddress, OP_SET_ROLE_CAPABILITY);
            storage.auth = auth.setRoleCapability(msg.role, msg.opcode, msg.enabled);
            storage.save();
        }
        SetUserRole => {
            auth.requireAuth(in.senderAddress, OP_SET_USER_ROLE);
            storage.auth = auth.setUserRole(msg.user, msg.role, msg.enabled);
            storage.save();
        }
        ProposeOwnership => {
            auth.requireAuth(in.senderAddress, OP_PROPOSE_OWNERSHIP);
            auth.ownerInfo.pendingOwner = msg.newOwner;
            auth.ownerInfo.proposeTime = blockchain.now();
            emitOwnershipProposed(in.senderAddress, msg.newOwner, auth.ownerInfo.proposeTime, auth.ownerInfo.timelockPeriod);
            storage.auth = auth.toCell();
            storage.save();
        }
        ClaimOwnership => {
            auth.requirePendingOwner(in.senderAddress);
            auth.requireTimelockPassed();
            auth.ownerInfo.owner = in.senderAddress;
            emitOwnershipClaimed(in.senderAddress);
            storage.auth = auth.clearPendingOwner();
            storage.save();
        }
        RevokePendingOwnership => {
            auth.requireAuth(in.senderAddress, OP_REVOKE_PENDING_OWNERSHIP);
            emitOwnershipRevoked(in.senderAddress, auth.ownerInfo.pendingOwner);
            storage.auth = auth.clearPendingOwner();
            storage.save();
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}

// a handler for bounced messages (not used here, may be ommited)
fun onBouncedMessage(in: InMessageBounced) {
}
