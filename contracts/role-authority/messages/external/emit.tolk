import "schemas";
import "../../constants/type"

/* Auth external messages functions */
fun emitPublicCapabilityUpdated(opcode: Opcode, enabled: bool) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_PUBLIC_CAPABILITY_UPDATED},
        body: PublicCapabilityUpdated {
            opcode: opcode,
            enabled: enabled,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}

fun emitRoleCapabilityUpdated(opcode: Opcode, role: RoleId, enabled: bool) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_ROLE_CAPABILITY_UPDATED},
        body: RoleCapabilityUpdated {
            opcode: opcode,
            role: role,
            enabled: enabled,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}

fun emitUserRoleUpdated(user: address, role: RoleId, enabled: bool) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_USER_ROLE_UPDATED},
        body: UserRoleUpdated {
            user: user,
            role: role,
            enabled: enabled,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}

fun emitOwnershipProposed(currentOwner: address, pendingOwner: address, proposeTime: Timestamp, timelockPeriod: Timestamp) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_OWNERSHIP_PROPOSED},
        body: OwnershipProposed {
            currentOwner: currentOwner,
            pendingOwner: pendingOwner,
            proposeTime: proposeTime,
            timelockPeriod: timelockPeriod,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}

fun emitOwnershipClaimed(sender: address) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_OWNERSHIP_CLAIMED},
        body: OwnershipClaimed {
            newOwner: sender,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}

fun emitOwnershipRevoked(revoker: address, revokedPendingOwner: address) {
    val emitMsg = createExternalLogMessage({
        dest: ExtOutLogBucket {topic: TOPIC_OWNERSHIP_REVOKED},
        body: OwnershipRevoked {
            revoker: revoker,
            revokedPendingOwner: revokedPendingOwner,
        }
    });
    emitMsg.send(SEND_MODE_REGULAR);
}