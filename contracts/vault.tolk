tolk 1.0

import "role-authority/auth";
import "role-authority/access";
import "role-authority/int-messages";
import "role-authority/ext-messages";
import "storage"
import "int-messages"
import "common/asset";
import "constants/constants";
import "constants/error";
import "constants/type";

fun mulDivWithRounding(x: int, y: int, z: int, rounding: RoundingType) {
    match (rounding) {
        ROUND_DOWN => {
            return mulDivFloor(x, y, z);
        }
        ROUND_UP => {
            return mulDivCeil(x, y, z);
        }
        else => {
            throw ERR_INVALID_ROUNDING_TYPE;
        }
    }
}

fun maxDeposit(depositAsset: Asset) {
    return MAX_COINS_VALUE;
}

fun convertToShares(depositAsset: Asset, depositedAmount: coins, rounding: RoundingType) {
    var storage = lazy Storage.load();
    val totalSupply = storage.totalSupply;
    val totalAssets = storage.totalAssets;
    return mulDivWithRounding(depositedAmount, totalSupply, totalAssets, rounding);
}

// depositAsset is for multi-asset vaults
fun previewDeposit(depositAmount: coins, depositAsset: Asset) {
    return convertToShares(depositAsset, depositAmount, ROUND_DOWN);
}

fun mintShares(sender: address, receiver: address, shares: coins, callbackParams: CallbackParams?, msgPayload: cell) {
    // TODO: Implement minting
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

            val maxDepositAmount = maxDeposit(tonAsset());
            assert (msg.depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

            val shares = previewDeposit(msg.depositAmount, tonAsset());

            // Check shares >= minMint
            assert (shares >= msg.vaultDepositParams.minMint) throw ERR_MIN_MINT_NOT_MET;

            // Mint shares to receiver
            mintShares(in.senderAddress, msg.vaultDepositParams.receiver, shares, msg.vaultDepositParams.sucPayload, msg.toCell());

            // Update storage
            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + msg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            auth.requireAuth(in.senderAddress, OP_TRANSFER_NOTIFICATION_FOR_RECIPIENT);
            // TODO
            match (msg.forwardPayload) {
                VaultDepositFp => {
                    auth.requireAuth(in.senderAddress, OP_VAULT_DEPOSIT_FP);
                    // TODO
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
