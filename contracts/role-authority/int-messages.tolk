import "constants/type";

/* Auth internal messages structs */
struct (0x714a73bb) SetPublicCapability {
    queryId: QueryId
    opcode: Opcode      // Target opcode to set public access for
    enabled: bool       // Whether to enable or disable public access to the opcode
}

struct (0xc6012bd0) SetRoleCapability {
    queryId: QueryId
    opcode: Opcode      // Target opcode to set the capability for
    role: RoleId        // Set this role to have the capability for the opcode
    enabled: bool       // Whether to enable or disable the role capability
}

struct (0xdd28b73e) SetUserRole {
    queryId: QueryId
    user: address       // Target user to set the role for
    role: RoleId        // Grant this role to the user
    enabled: bool       // Whether to enable or disable the user role
}

struct (0x9c25dd71) ProposeOwnership {
    queryId: QueryId
    newOwner: address
}

struct (0xb835b5cb) ClaimOwnership {
    queryId: QueryId
}

struct (0x3d89e313) RevokePendingOwnership {
    queryId: QueryId
}

/* Auth internal messages opcodes */
const OP_SET_PUBLIC_CAPABILITY = SetPublicCapability.getDeclaredPackPrefix();
const OP_SET_ROLE_CAPABILITY = SetRoleCapability.getDeclaredPackPrefix();
const OP_SET_USER_ROLE = SetUserRole.getDeclaredPackPrefix();
const OP_PROPOSE_OWNERSHIP = ProposeOwnership.getDeclaredPackPrefix();
const OP_REVOKE_PENDING_OWNERSHIP = RevokePendingOwnership.getDeclaredPackPrefix();

// Add `AuthMessages` to your internal messages union to enable the Auth system. 
type AuthMessages = SetUserRole | SetRoleCapability | SetPublicCapability | ProposeOwnership | ClaimOwnership | RevokePendingOwnership;
