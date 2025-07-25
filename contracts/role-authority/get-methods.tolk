import "../storage";
import "constants/type";
import "auth";

/// @title Optional Get Methods for Role Authority
/// @notice View functions for reading role and ownership data from the authority system.
/// @dev These methods are provided as reference implementations only. You can remove or modify them as needed:
/// - Your contract may use a different storage struct name (e.g., `JettonStorage` instead of `Storage`).
/// - Alternatively, you can read contract state off-chain and manually decode fields like `ownerInfo` or permission dicts.

/// Returns detailed information about the ownership status of the authority system.
/// @notice Provides the current owner, pending owner (if any), propose time, and timelock duration.
/// @return The OwnershipInfo structure containing:
///   - owner: The address of the current owner.
///   - pendingOwner: The address of the pending owner (address(0) if not set).
///   - proposeTime: The timestamp when the ownership transfer was proposed (0 if not set).
///   - timelockPeriod: The timelock period in seconds required before claiming ownership.
get fun ownerInfo(): OwnerInfo {
    val storage = lazy Storage.load();
    val auth = lazy storage.auth.load();
    return auth.ownerInfo;
}

/// Checks if an opcode has public capability.
/// @param opcode The opcode to check.
/// @return True if the opcode has public capability, false otherwise.
get fun publicCapability(opcode: Opcode): bool {
    val storage = lazy Storage.load();
    val auth = lazy storage.auth.load();
    return auth.checkPublicCapability(opcode);
}

/// Checks if a role has capability for a specific opcode.
/// @param role The role ID to check.
/// @param opcode The opcode to query.
/// @return True if the role has the capability, false otherwise.
get fun roleHasCapability(role: RoleId, opcode: Opcode): bool {
    val storage = lazy Storage.load();
    val auth = lazy storage.auth.load();
    return auth.checkRoleHasCapability(role, opcode);
}

/// Checks if a user has a specific role.
/// @param user The address of the user to check.
/// @param role The role ID to query.
/// @return True if the user has the role, false otherwise.
get fun userHasRole(user: address, role: RoleId): bool {
    val storage = lazy Storage.load();
    val auth = lazy storage.auth.load();
    return auth.checkUserHasRole(user, role);
}
