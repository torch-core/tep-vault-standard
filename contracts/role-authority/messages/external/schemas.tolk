import "../../constants/type";

/* Auth external messages structs */
struct(0xd213468c) PublicCapabilityUpdated {
    opcode: Opcode
    enabled: bool
}

struct(0x6aa264fa) RoleCapabilityUpdated {
    opcode: Opcode
    role: RoleId
    enabled: bool
}

struct(0x31322498) UserRoleUpdated {
    user: address
    role: RoleId
    enabled: bool
}

struct(0x261921b7) OwnershipProposed {
    currentOwner: address
    pendingOwner: address
    proposeTime: Timestamp
    timelockPeriod: Timestamp
}

struct(0x5aab7991) OwnershipClaimed {
    newOwner: address
}

struct(0x4f2bd7df) OwnershipRevoked {
    revoker: address
    revokedPendingOwner: address
}

/* Auth external messages topics */
const TOPIC_PUBLIC_CAPABILITY_UPDATED = PublicCapabilityUpdated.getDeclaredPackPrefix();
const TOPIC_ROLE_CAPABILITY_UPDATED = RoleCapabilityUpdated.getDeclaredPackPrefix();
const TOPIC_USER_ROLE_UPDATED = UserRoleUpdated.getDeclaredPackPrefix();
const TOPIC_OWNERSHIP_PROPOSED = OwnershipProposed.getDeclaredPackPrefix();
const TOPIC_OWNERSHIP_CLAIMED = OwnershipClaimed.getDeclaredPackPrefix();
const TOPIC_OWNERSHIP_REVOKED = OwnershipRevoked.getDeclaredPackPrefix();
