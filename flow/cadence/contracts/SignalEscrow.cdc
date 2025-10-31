import "FlowToken"
import "FungibleToken"
import "SignalCommitRegistry"

/// SignalEscrow manages fund escrow and settlement for signal purchases
/// Integrates with Flow Actions for automated fund handling
access(all) contract SignalEscrow {
    
    access(all) enum EscrowState: UInt8 {
        access(all) case Locked
        access(all) case Released
        access(all) case Disputed
        access(all) case Refunded
    }
    
    access(all) struct Escrow {
        access(all) let signalId: UInt64
        access(all) let buyer: Address
        access(all) let provider: Address
        access(all) let amount: UFix64
        access(all) let timestamp: UFix64
        access(all) var state: EscrowState
        access(all) var disputeDeadline: UFix64?
        access(all) var disputer: Address?

        init(
            signalId: UInt64,
            buyer: Address,
            provider: Address,
            amount: UFix64,
            timestamp: UFix64,
            state: EscrowState,
            disputeDeadline: UFix64?,
            disputer: Address?
        ) {
            self.signalId = signalId
            self.buyer = buyer
            self.provider = provider
            self.amount = amount
            self.timestamp = timestamp
            self.state = state
            self.disputeDeadline = disputeDeadline
            self.disputer = disputer
        }
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
        amount: UFix64,
        buyer: Address
    ): Bool {
        assert(amount >= self.MIN_ESCROW_AMOUNT, message: "Amount must be at least MIN_ESCROW_AMOUNT")
        assert(self.escrows[signalId] == nil, message: "Escrow already exists for this signal")
        
        let escrow = Escrow(
            signalId: signalId,
            buyer: buyer,
            provider: provider,
            amount: amount,
            timestamp: self.getCurrentBlockTimestamp(),
            state: EscrowState.Locked,
            disputeDeadline: nil,
            disputer: nil
        )
        
        self.escrows[signalId] = escrow
        
        // Track by buyer
        if self.buyerEscrows[buyer] == nil {
            self.buyerEscrows[buyer] = []
        }
        self.buyerEscrows[buyer]!.append(signalId)
        
        // Track by provider
        if self.providerEscrows[provider] == nil {
            self.providerEscrows[provider] = []
        }
        self.providerEscrows[provider]?.append(signalId)
        
        emit FundsLocked(
            signalId: signalId,
            buyer: buyer,
            provider: provider,
            amount: amount,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Release funds to provider after successful validation
    access(all) fun releaseFunds(signalId: UInt64): Bool {
        assert(self.escrows[signalId] != nil, message: "Escrow does not exist")
        
        let escrow = self.escrows[signalId]!
        assert(escrow.state == EscrowState.Locked, message: "Funds must be in Locked state")
        
        emit FundsReleased(
            signalId: signalId,
            provider: escrow.provider,
            amount: escrow.amount,
            timestamp: self.getCurrentBlockTimestamp()
        )
        let updatedReleased = Escrow(
            signalId: escrow.signalId,
            buyer: escrow.buyer,
            provider: escrow.provider,
            amount: escrow.amount,
            timestamp: escrow.timestamp,
            state: EscrowState.Released,
            disputeDeadline: escrow.disputeDeadline,
            disputer: escrow.disputer
        )
        self.escrows[signalId] = updatedReleased
        
        return true
    }
    
    /// Refund funds to buyer (e.g., validation failed or timeout)
    access(all) fun refundFunds(signalId: UInt64): Bool {
        assert(self.escrows[signalId] != nil, message: "Escrow does not exist")
        
        let escrow = self.escrows[signalId]!
        assert(escrow.state == EscrowState.Locked, message: "Funds must be in Locked state")
        
        emit FundsRefunded(
            signalId: signalId,
            buyer: escrow.buyer,
            amount: escrow.amount,
            timestamp: self.getCurrentBlockTimestamp()
        )
        let updatedRefunded = Escrow(
            signalId: escrow.signalId,
            buyer: escrow.buyer,
            provider: escrow.provider,
            amount: escrow.amount,
            timestamp: escrow.timestamp,
            state: EscrowState.Refunded,
            disputeDeadline: escrow.disputeDeadline,
            disputer: escrow.disputer
        )
        self.escrows[signalId] = updatedRefunded
        
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
    
    // No implicit caller in Cadence contract context
}
