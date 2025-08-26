import "../../constants/common-types"

struct (0xe43f93a9) DeployVault {
    queryId: QueryId
}

struct (0x2c76b973) RequestWalletAddress {
    queryId: QueryId
    ownerAddress: address
    includeOwnerAddress: bool
}

struct (0xd1735400) ResponseWalletAddress {
    queryId: QueryId
    jettonWalletAddress: address
    ownerAddress: Cell<address>?
}
