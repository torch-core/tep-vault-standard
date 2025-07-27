tolk 1.0

import "role-authority/auth";
import "role-authority/access";
import "role-authority/messages/internal/schemas";
import "role-authority/messages/external/emit";
import "storage"
import "messages/internal/schemas"
import "constants/errors";
import "fees-management";
import "helper/jetton";
import "types/asset";
import "core";
import "helper/paramResolver";

// the main entrypoint: called when a contract receives an message from other contracts
fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy Storage.load();
    var auth = lazy storage.auth.load();

    match (msg) {
        VaultDeposit => {
            auth.requireAuth(in.senderAddress, OP_VAULT_DEPOSIT);
            validateTonDepositGas(in.valueCoins, msg.depositAmount);

            val shares = handleDeposit(
                in.senderAddress, 
                msg.queryId, 
                in.senderAddress, 
                msg.depositAmount, 
                resolveDepositParams(msg.vaultDepositParams, in.senderAddress), 
                msg.toCell(), 
                Asset.tonAsset()
            );

            // Update storage
            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + msg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            auth.requireAuth(in.senderAddress, OP_TRANSFER_NOTIFICATION_FOR_RECIPIENT);

            match (msg.forwardPayload) {
                VaultDepositFp => {
                    auth.requireAuth(in.senderAddress, OP_VAULT_DEPOSIT_FP);
                    validateJettonDepositGas(in.valueCoins);

                    // Get Jetton Master Address by Jetton Wallet Address from jettonInfos dict
                    val jettonMaster = getJettonMasterFromWallet(storage.jettonInfos, in.senderAddress);

                    val shares = handleDeposit(
                        in.senderAddress, 
                        msg.queryId, 
                        msg.transferInitiator, 
                        msg.jettonAmount, 
                        resolveDepositParams(msg.forwardPayload.vaultDepositParams, msg.transferInitiator), 
                        msg.toCell(), 
                        Asset.jettonAsset(jettonMaster));

                    // Update storage
                    storage.totalSupply = storage.totalSupply + shares;
                    storage.totalAssets = storage.totalAssets + msg.jettonAmount;
                    storage.save();
                }
            }
        }

        BurnNotificationForMinter => {
            auth.requireAuth(in.senderAddress, OP_BURN_NOTIFICATION_FOR_MINTER);
            var burnPayload = msg.customPayload.load();
            match (burnPayload) {
                VaultWithdrawFp => {
                    auth.requireAuth(in.senderAddress, OP_VAULT_WITHDRAW_FP);
                    validateWithdrawGas(in.valueCoins);

                    val withdrawAsset = burnPayload.withdrawAsset != null ? burnPayload.withdrawAsset!.load() : null;
                    val withdrawAmount = handleWithdraw(
                        in.senderAddress, 
                        msg.jettonAmount, 
                        resolveWithdrawParams(burnPayload, in.senderAddress), 
                        msg.toCell(), 
                        withdrawAsset
                    );

                    // Update storage
                    storage.totalSupply = storage.totalSupply - msg.jettonAmount;
                    storage.totalAssets = storage.totalAssets - withdrawAmount;
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
