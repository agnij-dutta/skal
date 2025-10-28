import "FlowToken"
import "FlowTransactionScheduler"
import "FlowTransactionSchedulerUtils"

/// SignalCommitRegistry manages commit-reveal cycles for AI intelligence signals (tasks)
/// Integrates with Flow Scheduled Transactions for auto-reveal functionality
access(all) contract SignalCommitRegistry {
    
    // Signal states
    access(all) enum SignalState {
        Committed
        Revealed
        Validated
        Settled
        Disputed
        Cancelled
    }
    
    // Signal structure
    access(all) struct Signal {
        signalId: UInt64
        commitHash: String  // SHA3-256 hash of (provider + signalData + salt)
        provider: Address
        marketId: UInt64
        stake: UFix64
        timestamp: UFix64
        state: SignalState
        cid: String?  // IPFS CID for revealed data
        validationScore: UInt8?
        verifier: Address?
        revealDeadline: UFix64
        validationDeadline: UFix64?
        scheduledTxId: UInt64?  // Scheduled transaction ID for auto-reveal
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
        stake: UFix64
    ): UInt64 {
        pre {
            stake >= self.MIN_STAKE: "Stake must be at least MIN_STAKE"
            stake > 0.0: "Stake must be greater than 0"
        }
        
        let signalId = self.nextSignalId
        self.nextSignalId = self.nextSignalId + 1
        
        let currentTime = self.getCurrentBlockTimestamp()
        let revealDeadline = currentTime + self.REVEAL_WINDOW
        
        let signal = Signal(
            signalId: signalId,
            commitHash: commitHash,
            provider: self.getAccountCaller(),
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
        if self.providerSignals[self.getAccountCaller()] == nil {
            self.providerSignals[self.getAccountCaller()] = []
        }
        self.providerSignals[self.getAccountCaller()]?.append(signalId)
        
        // Track by market
        if self.marketSignals[marketId] == nil {
            self.marketSignals[marketId] = []
        }
        self.marketSignals[marketId]?.append(signalId)
        
        emit SignalCommitted(
            signalId: signalId,
            commitHash: commitHash,
            provider: self.getAccountCaller(),
            marketId: marketId,
            stake: stake,
            timestamp: currentTime
        )
        
        return signalId
    }
    
    /// Reveal signal data (CID) that matches the committed hash
    access(all) fun revealSignal(signalId: UInt64, cid: String, revealedData: String): Bool {
        pre {
            self.signals[signalId] != nil: "Signal does not exist"
        }
        
        let signal = &self.signals[signalId] as &Signal
        pre {
            signal.state == SignalState.Committed: "Signal must be in Committed state"
            self.getCurrentBlockTimestamp() <= signal.revealDeadline: "Reveal deadline passed"
        }
        
        // In production, verify: hash(provider + revealedData + salt) == commitHash
        // For now, accept any CID during reveal window
        
        signal.cid = cid
        signal.state = SignalState.Revealed
        signal.validationDeadline = self.getCurrentBlockTimestamp() + self.VALIDATION_WINDOW
        
        emit SignalRevealed(
            signalId: signalId,
            cid: cid,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Validate signal with score (called by verifiers)
    access(all) fun validateSignal(signalId: UInt64, score: UInt8): Bool {
        pre {
            score <= 100: "Score must be between 0-100"
            self.signals[signalId] != nil: "Signal does not exist"
        }
        
        let signal = &self.signals[signalId] as &Signal
        pre {
            signal.state == SignalState.Revealed: "Signal must be revealed first"
            signal.validationDeadline != nil: "Validation deadline not set"
        }
        
        signal.validationScore = score
        signal.verifier = self.getAccountCaller()
        signal.state = SignalState.Validated
        
        emit SignalValidated(
            signalId: signalId,
            score: score,
            verifier: self.getAccountCaller(),
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Settle signal (release funds) after validation
    access(all) fun settleSignal(signalId: UInt64): Bool {
        pre {
            self.signals[signalId] != nil: "Signal does not exist"
        }
        
        let signal = &self.signals[signalId] as &Signal
        pre {
            signal.state == SignalState.Validated: "Signal must be validated"
        }
        
        signal.state = SignalState.Settled
        
        emit SignalSettled(
            signalId: signalId,
            provider: signal.provider,
            payout: signal.stake,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Auto-reveal called by Scheduled Transaction
    access(FlowTransactionScheduler.Execute) fun autoReveal(signalId: UInt64) {
        pre {
            self.signals[signalId] != nil: "Signal does not exist"
        }
        
        let signal = &self.signals[signalId] as &Signal
        if signal.state == SignalState.Committed {
            // Force reveal with placeholder data if provider didn't reveal
            // This prevents stake from being locked indefinitely
            signal.state = SignalState.Revealed
            signal.cid = ""  // Empty CID indicates forced reveal
            signal.validationDeadline = self.getCurrentBlockTimestamp() + self.VALIDATION_WINDOW
            
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
    
    /// Helper: get caller account address
    access(all) fun getAccountCaller(): Address {
        return self.owner?.address ?? panic("Cannot get caller")
    }
}
