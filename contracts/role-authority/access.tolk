import "auth";
import "constants/type";
import "constants/error";

/// Checks if an opcode has public capability.
/// @param self The Auth structure instance.
/// @param opcode The opcode to check.
/// @return True if the opcode has public capability, false otherwise.
@pure
fun Auth.checkPublicCapability(self, opcode: Opcode): bool {
    return self.getPublicCapability(opcode);
}

/// Checks if a role has capability for a specific opcode.
/// @param self The Auth structure instance.
/// @param role The role ID to check.
/// @param opcode The opcode to query.
/// @return True if the role has the capability, false otherwise.
/// @dev Checks the bit at position `role` in the opcode's RoleMask using bitwise operations.
///      Specifically: (opRoleMask >> role) shifts the bit to the lowest position, & 1 isolates it.
fun Auth.checkRoleHasCapability(self, role: RoleId, opcode: Opcode): bool {
    val opRoleMask = self.getRoleCapability(opcode);
    return ((opRoleMask >> role) & 1) != 0;
}

/// Checks if a user has a specific role.
/// @param self The Auth structure instance.
/// @param user The address of the user to check.
/// @param role The role ID to query.
/// @return True if the user has the role, false otherwise.
/// @dev Uses the same bitmask logic as `checkRoleHasCapability` to check the user's role assignment.
@pure
fun Auth.checkUserHasRole(self, user: address, role: RoleId): bool {
    val userRoleMask = self.getUserRoles(user);
    return ((userRoleMask >> role) & 1) != 0;
}

/// Determines if a user can call a specific opcode based on roles or public capability.
/// @param self The Auth structure instance.
/// @param user The address of the user to check.
/// @param opcode The opcode to query.
/// @return True if the user can call the opcode, false otherwise.
/// @dev Returns true if the opcode is marked public, or if the user's RoleMask intersects
///      with the opcode's RoleMask.
@pure
fun Auth.canCall(self, user: address, opcode: Opcode): bool {
    val isPublic = self.getPublicCapability(opcode);
    val opRoleMask = self.getRoleCapability(opcode);
    val userRoleMask = self.getUserRoles(user);

    return isPublic || (userRoleMask & opRoleMask) != 0;
}

/// Checks if a user is authorized for an opcode, including owner fallback.
/// @param self The Auth structure instance.
/// @param user The address of the user to check.
/// @param opcode The opcode to query.
/// @return True if authorized (via roles, public, or owner), false otherwise.
@pure
fun Auth.isAuthorized(self, user: address, opcode: Opcode): bool {
    return self.canCall(user, opcode) || user == self.ownerInfo.owner;
}

/// Requires that a user is authorized for an opcode, or throws an error.
/// @param self The Auth structure instance.
/// @param user The address of the user to check.
/// @param opcode The opcode to query.
/// @dev Throws ERR_NOT_AUTHORIZED if not authorized.
fun Auth.requireAuth(self, user: address, opcode: Opcode) {
    assert(self.isAuthorized(user, opcode), ERR_NOT_AUTHORIZED);
}

/// Requires that the sender is the pending owner.
/// @param self The Auth structure instance.
/// @param sender The address of the sender to claim the ownership.
/// @dev Throws ERR_NOT_PENDING_OWNER if sender is not the pending owner.
fun Auth.requirePendingOwner(self, sender: address) {
    assert(sender == self.ownerInfo.pendingOwner, ERR_NOT_PENDING_OWNER);
}

/// Requires that the timelock period has passed for a pending ownership transfer.
/// @param self The Auth structure instance.
/// @dev Throws ERR_CLAIM_TOO_EARLY if the timelock period has not elapsed.
fun Auth.requireTimelockPassed(self) {
    assert(blockchain.now() >= self.ownerInfo.proposeTime + self.ownerInfo.timelockPeriod, ERR_CLAIM_TOO_EARLY);
}