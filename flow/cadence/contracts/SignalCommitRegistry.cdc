import "FlowToken"

/// SignalCommitRegistry manages commit-reveal cycles for AI intelligence signals (tasks)
/// Integrates with Flow Scheduled Transactions for auto-reveal functionality
access(all) contract SignalCommitRegistry {
    
    // Signal states
    access(all) enum SignalState: UInt8 {
        access(all) case Committed
        access(all) case Revealed
        access(all) case Validated
        access(all) case Settled
        access(all) case Disputed
        access(all) case Cancelled
    }
    
    // Signal structure
    access(all) struct Signal {
        access(all) let signalId: UInt64
        access(all) let commitHash: String
        access(all) let provider: Address
        access(all) let marketId: UInt64
        access(all) let stake: UFix64
        access(all) let timestamp: UFix64
        access(all) var state: SignalState
        access(all) var cid: String?
        access(all) var validationScore: UInt8?
        access(all) var verifier: Address?
        access(all) let revealDeadline: UFix64
        access(all) var validationDeadline: UFix64?
        access(all) var scheduledTxId: UInt64?

        init(
            signalId: UInt64,
            commitHash: String,
            provider: Address,
            marketId: UInt64,
            stake: UFix64,
            timestamp: UFix64,
            state: SignalState,
            cid: String?,
            validationScore: UInt8?,
            verifier: Address?,
            revealDeadline: UFix64,
            validationDeadline: UFix64?,
            scheduledTxId: UInt64?
        ) {
            self.signalId = signalId
            self.commitHash = commitHash
            self.provider = provider
            self.marketId = marketId
            self.stake = stake
            self.timestamp = timestamp
            self.state = state
            self.cid = cid
            self.validationScore = validationScore
            self.verifier = verifier
            self.revealDeadline = revealDeadline
            self.validationDeadline = validationDeadline
            self.scheduledTxId = scheduledTxId
        }
    }
    
    // Events
    access(all) event SignalCommitted(
        signalId: UInt64,
        commitHash: String,
        provider: Address,
        marketId: UInt64,
        stake: UFix64,
        timestamp: UFix64
    )
    
    access(all) event SignalRevealed(
        signalId: UInt64,
        cid: String,
        timestamp: UFix64
    )
    
    access(all) event SignalValidated(
        signalId: UInt64,
        score: UInt8,
        verifier: Address,
        timestamp: UFix64
    )
    
    access(all) event SignalSettled(
        signalId: UInt64,
        provider: Address,
        payout: UFix64,
        timestamp: UFix64
    )
    
    // State storage
    access(all) var nextSignalId: UInt64
    access(all) var signals: {UInt64: Signal}
    access(all) var providerSignals: {Address: [UInt64]}
    access(all) var marketSignals: {UInt64: [UInt64]}
    
    // Configuration constants
    access(all) let COMMIT_WINDOW: UFix64  // 1 hour
    access(all) let REVEAL_WINDOW: UFix64  // 24 hours
    access(all) let VALIDATION_WINDOW: UFix64  // 2 hours
    access(all) let MIN_STAKE: UFix64  // 0.01 FLOW
    
    init() {
        self.nextSignalId = 1
        self.signals = {}
        self.providerSignals = {}
        self.marketSignals = {}
        
        self.COMMIT_WINDOW = 3600.0  // 1 hour in seconds
        self.REVEAL_WINDOW = 86400.0  // 24 hours
        self.VALIDATION_WINDOW = 7200.0  // 2 hours
        self.MIN_STAKE = 0.01
    }
    
    /// Commit a signal hash (commit-reveal pattern)
    access(all) fun commitSignal(
        commitHash: String,
        marketId: UInt64,
        stake: UFix64,
        provider: Address
    ): UInt64 {
        assert(stake >= self.MIN_STAKE, message: "Stake must be at least MIN_STAKE")
        assert(stake > 0.0, message: "Stake must be greater than 0")
        
        let signalId = self.nextSignalId
        self.nextSignalId = self.nextSignalId + 1
        
        let currentTime = self.getCurrentBlockTimestamp()
        let revealDeadline = currentTime + self.REVEAL_WINDOW
        
        let signal = Signal(
            signalId: signalId,
            commitHash: commitHash,
            provider: provider,
            marketId: marketId,
            stake: stake,
            timestamp: currentTime,
            state: SignalState.Committed,
            cid: nil,
            validationScore: nil,
            verifier: nil,
            revealDeadline: revealDeadline,
            validationDeadline: nil,
            scheduledTxId: nil
        )
        
        self.signals[signalId] = signal
        
        // Track by provider
        if self.providerSignals[provider] == nil {
            self.providerSignals[provider] = []
        }
        self.providerSignals[provider]!.append(signalId)
        
        // Track by market
        if self.marketSignals[marketId] == nil {
            self.marketSignals[marketId] = []
        }
        self.marketSignals[marketId]!.append(signalId)
        
        emit SignalCommitted(
            signalId: signalId,
            commitHash: commitHash,
            provider: provider,
            marketId: marketId,
            stake: stake,
            timestamp: currentTime
        )
        
        return signalId
    }
    
    /// Reveal signal data (CID) that matches the committed hash
    access(all) fun revealSignal(signalId: UInt64, cid: String, revealedData: String): Bool {
        assert(self.signals[signalId] != nil, message: "Signal does not exist")
        
        let signal = self.signals[signalId]!
        assert(signal.state == SignalState.Committed, message: "Signal must be in Committed state")
        assert(self.getCurrentBlockTimestamp() <= signal.revealDeadline, message: "Reveal deadline passed")
        
        // In production, verify: hash(provider + revealedData + salt) == commitHash
        // For now, accept any CID during reveal window
        
        let updated = Signal(
            signalId: signal.signalId,
            commitHash: signal.commitHash,
            provider: signal.provider,
            marketId: signal.marketId,
            stake: signal.stake,
            timestamp: signal.timestamp,
            state: SignalState.Revealed,
            cid: cid,
            validationScore: signal.validationScore,
            verifier: signal.verifier,
            revealDeadline: signal.revealDeadline,
            validationDeadline: self.getCurrentBlockTimestamp() + self.VALIDATION_WINDOW,
            scheduledTxId: signal.scheduledTxId
        )
        self.signals[signalId] = updated
        
        emit SignalRevealed(
            signalId: signalId,
            cid: cid,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Validate signal with score (called by verifiers)
    access(all) fun validateSignal(signalId: UInt64, score: UInt8, verifier: Address): Bool {
        assert(score <= 100, message: "Score must be between 0-100")
        assert(self.signals[signalId] != nil, message: "Signal does not exist")
        let signal = self.signals[signalId]!
        assert(signal.state == SignalState.Revealed, message: "Signal must be revealed first")
        assert(signal.validationDeadline != nil, message: "Validation deadline not set")
        let updatedVal = Signal(
            signalId: signal.signalId,
            commitHash: signal.commitHash,
            provider: signal.provider,
            marketId: signal.marketId,
            stake: signal.stake,
            timestamp: signal.timestamp,
            state: SignalState.Validated,
            cid: signal.cid,
            validationScore: score,
            verifier: verifier,
            revealDeadline: signal.revealDeadline,
            validationDeadline: signal.validationDeadline,
            scheduledTxId: signal.scheduledTxId
        )
        self.signals[signalId] = updatedVal
        
        emit SignalValidated(
            signalId: signalId,
            score: score,
            verifier: verifier,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Settle signal (release funds) after validation
    access(all) fun settleSignal(signalId: UInt64): Bool {
        assert(self.signals[signalId] != nil, message: "Signal does not exist")
        
        let signal = self.signals[signalId]!
        assert(signal.state == SignalState.Validated, message: "Signal must be validated")
        let updatedSettle = Signal(
            signalId: signal.signalId,
            commitHash: signal.commitHash,
            provider: signal.provider,
            marketId: signal.marketId,
            stake: signal.stake,
            timestamp: signal.timestamp,
            state: SignalState.Settled,
            cid: signal.cid,
            validationScore: signal.validationScore,
            verifier: signal.verifier,
            revealDeadline: signal.revealDeadline,
            validationDeadline: signal.validationDeadline,
            scheduledTxId: signal.scheduledTxId
        )
        self.signals[signalId] = updatedSettle
        
        emit SignalSettled(
            signalId: signalId,
            provider: signal.provider,
            payout: signal.stake,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Auto-reveal called by Scheduled Transaction
    access(all) fun autoReveal(signalId: UInt64) {
        assert(self.signals[signalId] != nil, message: "Signal does not exist")
        
        let signal = self.signals[signalId]!
        if signal.state == SignalState.Committed {
            // Force reveal with placeholder data if provider didn't reveal
            // This prevents stake from being locked indefinitely
            let forced = Signal(
                signalId: signal.signalId,
                commitHash: signal.commitHash,
                provider: signal.provider,
                marketId: signal.marketId,
                stake: signal.stake,
                timestamp: signal.timestamp,
                state: SignalState.Revealed,
                cid: "",
                validationScore: signal.validationScore,
                verifier: signal.verifier,
                revealDeadline: signal.revealDeadline,
                validationDeadline: self.getCurrentBlockTimestamp() + self.VALIDATION_WINDOW,
                scheduledTxId: signal.scheduledTxId
            )
            self.signals[signalId] = forced
            
            emit SignalRevealed(
                signalId: signalId,
                cid: "",
                timestamp: self.getCurrentBlockTimestamp()
            )
        }
    }
    
    /// Get signal details
    access(all) fun getSignal(signalId: UInt64): Signal? {
        return self.signals[signalId]
    }
    
    /// Get signals by provider
    access(all) fun getSignalsByProvider(provider: Address): [UInt64] {
        return self.providerSignals[provider] ?? []
    }
    
    /// Get signals by market
    access(all) fun getSignalsByMarket(marketId: UInt64): [UInt64] {
        return self.marketSignals[marketId] ?? []
    }
    
    /// Helper: get current block timestamp
    access(all) fun getCurrentBlockTimestamp(): UFix64 {
        return getCurrentBlock().timestamp
    }
    
    // No implicit caller in Cadence contract context
}
