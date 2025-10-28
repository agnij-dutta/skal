import "FlowToken"
import "FungibleToken"
import "SignalCommitRegistry"

/// SignalEscrow manages fund escrow and settlement for signal purchases
/// Integrates with Flow Actions for automated fund handling
access(all) contract SignalEscrow {
    
    access(all) enum EscrowState {
        Locked
        Released
        Disputed
        Refunded
    }
    
    access(all) struct Escrow {
        signalId: UInt64
        buyer: Address
        provider: Address
        amount: UFix64
        timestamp: UFix64
        state: EscrowState
        disputeDeadline: UFix64?
        disputer: Address?
    }
    
    access(all) event FundsLocked(
        signalId: UInt64,
        buyer: Address,
        provider: Address,
        amount: UFix64,
        timestamp: UFix64
    )
    
    access(all) event FundsReleased(
        signalId: UInt64,
        provider: Address,
        amount: UFix64,
        timestamp: UFix64
    )
    
    access(all) event FundsRefunded(
        signalId: UInt64,
        buyer: Address,
        amount: UFix64,
        timestamp: UFix64
    )
    
    access(all) var escrows: {UInt64: Escrow}
    access(all) var buyerEscrows: {Address: [UInt64]}
    access(all) var providerEscrows: {Address: [UInt64]}
    
    access(all) let DISPUTE_WINDOW: UFix64  // 24 hours
    access(all) let MIN_ESCROW_AMOUNT: UFix64  // 0.001 FLOW
    access(all) let PROTOCOL_FEE_PERCENT: UFix64  // 2.5%
    access(all) let VERIFIER_FEE_PERCENT: UFix64  // 2.0%
    
    init() {
        self.escrows = {}
        self.buyerEscrows = {}
        self.providerEscrows = {}
        
        self.DISPUTE_WINDOW = 86400.0  // 24 hours in seconds
        self.MIN_ESCROW_AMOUNT = 0.001
        self.PROTOCOL_FEE_PERCENT = 250.0  // 2.5% = 250/10000
        self.VERIFIER_FEE_PERCENT = 200.0  // 2.0% = 200/10000
    }
    
    /// Lock funds for signal purchase
    access(all) fun lockFunds(
        signalId: UInt64,
        provider: Address,
        amount: UFix64
    ): Bool {
        pre {
            amount >= self.MIN_ESCROW_AMOUNT: "Amount must be at least MIN_ESCROW_AMOUNT"
            self.escrows[signalId] == nil: "Escrow already exists for this signal"
        }
        
        let escrow = Escrow(
            signalId: signalId,
            buyer: self.getAccountCaller(),
            provider: provider,
            amount: amount,
            timestamp: self.getCurrentBlockTimestamp(),
            state: EscrowState.Locked,
            disputeDeadline: nil,
            disputer: nil
        )
        
        self.escrows[signalId] = escrow
        
        // Track by buyer
        if self.buyerEscrows[self.getAccountCaller()] == nil {
            self.buyerEscrows[self.getAccountCaller()] = []
        }
        self.buyerEscrows[self.getAccountCaller()]?.append(signalId)
        
        // Track by provider
        if self.providerEscrows[provider] == nil {
            self.providerEscrows[provider] = []
        }
        self.providerEscrows[provider]?.append(signalId)
        
        emit FundsLocked(
            signalId: signalId,
            buyer: self.getAccountCaller(),
            provider: provider,
            amount: amount,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Release funds to provider after successful validation
    access(all) fun releaseFunds(signalId: UInt64): Bool {
        pre {
            self.escrows[signalId] != nil: "Escrow does not exist"
        }
        
        let escrow = &self.escrows[signalId] as &Escrow
        pre {
            escrow.state == EscrowState.Locked: "Funds must be in Locked state"
        }
        
        escrow.state = EscrowState.Released
        
        emit FundsReleased(
            signalId: signalId,
            provider: escrow.provider,
            amount: escrow.amount,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Refund funds to buyer (e.g., validation failed or timeout)
    access(all) fun refundFunds(signalId: UInt64): Bool {
        pre {
            self.escrows[signalId] != nil: "Escrow does not exist"
        }
        
        let escrow = &self.escrows[signalId] as &Escrow
        pre {
            escrow.state == EscrowState.Locked: "Funds must be in Locked state"
        }
        
        escrow.state = EscrowState.Refunded
        
        emit FundsRefunded(
            signalId: signalId,
            buyer: escrow.buyer,
            amount: escrow.amount,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Get escrow details
    access(all) fun getEscrow(signalId: UInt64): Escrow? {
        return self.escrows[signalId]
    }
    
    /// Calculate protocol fees
    access(all) fun calculateProtocolFee(amount: UFix64): UFix64 {
        return (amount * self.PROTOCOL_FEE_PERCENT) / 10000.0
    }
    
    /// Calculate verifier fees
    access(all) fun calculateVerifierFee(amount: UFix64): UFix64 {
        return (amount * self.VERIFIER_FEE_PERCENT) / 10000.0
    }
    
    access(all) fun getCurrentBlockTimestamp(): UFix64 {
        return getCurrentBlock().timestamp
    }
    
    access(all) fun getAccountCaller(): Address {
        return self.owner?.address ?? panic("Cannot get caller")
    }
}
