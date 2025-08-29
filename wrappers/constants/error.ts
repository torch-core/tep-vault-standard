export const VaultErrors = {
    // General Errors (0-999)
    WrongOpCode: 0xffff,
    UnauthorizedAdmin: 1002,
    InvalidJettonWallet: 1003,
    InvalidJettonMaster: 1004,

    // Deposit Errors (2000-2999)
    MissingForwardPayload: 2000,
    FailedMinShares: 2002,
    InsufficientTonDepositGas: 2003,
    InsufficientJettonDepositGas: 2004,
    InvalidDepositAmount: 2005,
    NonSupportedJettonDeposit: 2006,
    NonSupportedExtraCurrencyDeposit: 2007,
    InvalidExtraCurrencyId: 2008,
    InsufficientExtraCurrencyDepositGas: 2009,
    NonSupportedTonDeposit: 2010,
    NonExtraCurrencyDeposit: 2011,
    NonJettonDeposit: 2012,
    MultiExtraCurrencyDeposit: 2013,

    // Withdraw Errors (3000-3999)
    MissingCustomPayload: 3000,
    FailedMinWithdraw: 3002,
    InsufficientWithdrawGas: 3003,
    InvalidBurnAmount: 3004,

    // Authorization Errors (4000-4999)
    UnauthorizedBurn: 4000,

    // Quote Operation Errors
    InsufficientProvideQuoteGas: 5000,
};
