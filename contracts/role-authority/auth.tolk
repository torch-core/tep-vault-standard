import "@stdlib/tvm-dicts";
import "constants/size";
import "constants/type";
import "messages/external/emit";
import "pack";

/// The main structure managing the authority data, including owner and permission dictionaries.
/// The system supports up to 256 distinct roles in total, represented as bits in a RoleMask (uint256).
/// Each role ID corresponds to a bit position in the RoleMask (e.g., role 0 = 1 << 0, role 1 = 1 << 1, etc.).
/// A user's roles or an opcode's allowed roles are encoded as a combined bitmask.
/// For example, roles 1 and 3 result in a RoleMask of 0b00001010 (1 << 1 | 1 << 3).
/// This struct should be included in your contract's storage layout.
struct Auth {
    ownerInfo: OwnerInfo            // Stores ownership data, including current owner, pending owner, and timelock info.
    isCapabilityPublic: dict        // Dict<Opcode, bool>: Indicates if an opcode is public.
    rolesWithCapability: dict       // Dict<Opcode, RoleMask>: Maps each opcode to the roles that are allowed to execute it (an opcode can be assigned to multiple roles).
    userRoles: dict                 // Dict<address, RoleMask>: Maps user addresses to their assigned roles (a user can have multiple roles).
}

/// Encapsulates ownership transfer information, including timelock parameters.
struct OwnerInfo {
    owner: address                  // Address of the contract owner, who also manages the authority logic.
    pendingOwner: address           // Address of the pending owner, who can claim the ownership after the timelock period.
    timelockPeriod: Timestamp       // Timelock period for the ownership can be claimed.
    proposeTime: Timestamp          // Timestamp of the ownership proposal.
}

/// Retrieves whether a given opcode has public capability.
/// @param self The Auth structure instance.
/// @param opcode The opcode to check.
/// @return True if the opcode has public capability, false otherwise.
@pure
fun Auth.getPublicCapability(self, opcode: Opcode): bool {
    var (isPublic, found) = self.isCapabilityPublic.uDictGet(OPCODE_SIZE, opcode);
    return found ? isPublic!.loadBool() : false;
}

/// Retrieves the role mask for a given opcode's capabilities.
/// @param self The Auth structure instance.
/// @param opcode The opcode to check.
/// @return The role mask for the opcode (0 if not found).
@pure
fun Auth.getRoleCapability(self, opcode: Opcode): RoleMask {
    var (opRoleMask, found) = self.rolesWithCapability.uDictGet(OPCODE_SIZE, opcode);    
    return (found ? opRoleMask!.loadUint(ROLE_MASK_SIZE) : 0) as RoleMask;
}

/// Retrieves the role mask for a given user.
/// @param self The Auth structure instance.
/// @param user The address of the user to check.
/// @return The role mask for the user (0 if not found).
@pure
fun Auth.getUserRoles(self, user: address): RoleMask {
    var (userRoleMask, found) = self.userRoles.sDictGet(ADDRESS_SIZE, user as slice);
    return (found ? userRoleMask!.loadUint(ROLE_MASK_SIZE) : 0) as RoleMask;
}

/// Sets the public capability for a given opcode.
/// @param self The mutable Auth structure instance.
/// @param opcode The opcode to set.
/// @param enabled True to enable public capability, false to disable.
/// @dev Emits an TOPIC_PUBLIC_CAPABILITY_UPDATED event after setting the capability.
fun Auth.setPublicCapability(mutate self, opcode: Opcode, enabled: bool) {
    self.isCapabilityPublic.uDictSet(OPCODE_SIZE, opcode, packDictSliceValue(enabled));
    emitPublicCapabilityUpdated(opcode, enabled);

    return self.toCell();
}

/// Sets the capability for a specific role on a given opcode.
/// @param self The mutable Auth structure instance.
/// @param role The role ID to set (0-255).
/// @param opcode The opcode to set the capability for.
/// @param enabled True to enable the role for the opcode, false to disable.
/// @dev Emits an TOPIC_ROLE_CAPABILITY_UPDATED event after updating the role capability.
fun Auth.setRoleCapability(mutate self, role: RoleId, opcode: Opcode, enabled: bool) {
    val currentMask = self.getRoleCapability(opcode);
    val newMask = enabled ? (currentMask | 1 << role) : (currentMask & ~(1 << role));
    self.rolesWithCapability.uDictSet(OPCODE_SIZE, opcode, packDictSliceValue(newMask));
    emitRoleCapabilityUpdated(opcode, role, enabled);

    return self.toCell();
}

/// Sets a role for a specific user.
/// @param self The mutable Auth structure instance.
/// @param user The address of the user to update.
/// @param role The role ID to set (0-255).
/// @param enabled True to enable the role for the user, false to disable.
/// @dev Emits an TOPIC_USER_ROLE_UPDATED event after updating the user's role.
fun Auth.setUserRole(mutate self, user: address, role: RoleId, enabled: bool) {
    val currentMask = self.getUserRoles(user);
    val newMask = enabled ? (currentMask | 1 << role) : (currentMask & ~(1 << role));
    self.userRoles.sDictSet(ADDRESS_SIZE, user as slice, packDictSliceValue(newMask));
    emitUserRoleUpdated(user, role, enabled);
    
    return self.toCell();
}

/// @dev Clears pending owner information after ownership claim or revocation
/// @notice Resets pendingOwner to none and proposeTime to 0
/// @return cell The updated auth state as a cell
fun Auth.clearPendingOwner(mutate self) {
    self.ownerInfo.pendingOwner = createAddressNone();
    self.ownerInfo.proposeTime = 0;

    return self.toCell();
}