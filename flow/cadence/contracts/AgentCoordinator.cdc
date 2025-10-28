import "FlowToken"

/// AgentCoordinator - Manages agent registration and reputation tracking
access(all) contract AgentCoordinator {
    
    access(all) enum AgentType {
        Provider
        Buyer
        Verifier
        LP
        Oracle
    }
    
    access(all) struct Agent {
        agentId: UInt64
        agentAddress: Address
        agentType: AgentType
        name: String
        description: String
        stake: UFix64
        registeredAt: UFix64
        lastActivity: UFix64
        reputation: UFix64  // 0-100
        totalTasks: UInt64
        successfulTasks: UInt64
    }
    
    access(all) event AgentRegistered(
        agentId: UInt64,
        agentAddress: Address,
        agentType: AgentType,
        stake: UFix64,
        timestamp: UFix64
    )
    
    access(all) event ReputationUpdated(
        agentId: UInt64,
        oldReputation: UFix64,
        newReputation: UFix64,
        timestamp: UFix64
    )
    
    access(all) var nextAgentId: UInt64
    access(all) var agents: {UInt64: Agent}
    access(all) var addressToAgentId: {Address: UInt64}
    access(all) var agentsByType: {AgentType: [UInt64]}
    
    access(all) let MIN_STAKE: UFix64  // Minimum stake for registration
    
    init() {
        self.nextAgentId = 1
        self.agents = {}
        self.addressToAgentId = {}
        self.agentsByType = {}
        self.MIN_STAKE = 1.0  // 1 FLOW
    }
    
    /// Register a new agent
    access(all) fun registerAgent(
        agentAddress: Address,
        agentType: AgentType,
        name: String,
        description: String,
        stake: UFix64
    ): UInt64 {
        pre {
            stake >= self.MIN_STAKE: "Stake must be at least MIN_STAKE"
            self.addressToAgentId[agentAddress] == nil: "Agent already registered"
        }
        
        let agentId = self.nextAgentId
        self.nextAgentId = self.nextAgentId + 1
        
        let agent = Agent(
            agentId: agentId,
            agentAddress: agentAddress,
            agentType: agentType,
            name: name,
            description: description,
            stake: stake,
            registeredAt: self.getCurrentBlockTimestamp(),
            lastActivity: self.getCurrentBlockTimestamp(),
            reputation: 50.0,  // Start at neutral
            totalTasks: 0,
            successfulTasks: 0
        )
        
        self.agents[agentId] = agent
        self.addressToAgentId[agentAddress] = agentId
        
        // Track by type
        if self.agentsByType[agentType] == nil {
            self.agentsByType[agentType] = []
        }
        self.agentsByType[agentType]?.append(agentId)
        
        emit AgentRegistered(
            agentId: agentId,
            agentAddress: agentAddress,
            agentType: agentType,
            stake: stake,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return agentId
    }
    
    /// Update agent activity timestamp
    access(all) fun updateActivity(agentId: UInt64): Bool {
        if let agent = &self.agents[agentId] as &Agent? {
            agent?.lastActivity = self.getCurrentBlockTimestamp()
            return true
        }
        return false
    }
    
    /// Update agent reputation based on task success
    access(all) fun updateReputation(agentId: UInt64, success: Bool): Bool {
        pre {
            self.agents[agentId] != nil: "Agent does not exist"
        }
        
        let agent = &self.agents[agentId] as &Agent
        let oldReputation = agent.reputation
        
        agent.totalTasks = agent.totalTasks + 1
        if success {
            agent.successfulTasks = agent.successfulTasks + 1
        }
        
        // Calculate new reputation: weighted average
        // Base: 50% reputation, Activity: 50% success rate
        let successRate = UFix64(agent.successfulTasks) / UFix64(agent.totalTasks)
        agent.reputation = (oldReputation * 0.5) + (successRate * 100.0 * 0.5)
        
        // Clamp to 0-100
        if agent.reputation > 100.0 {
            agent.reputation = 100.0
        }
        if agent.reputation < 0.0 {
            agent.reputation = 0.0
        }
        
        emit ReputationUpdated(
            agentId: agentId,
            oldReputation: oldReputation,
            newReputation: agent.reputation,
            timestamp: self.getCurrentBlockTimestamp()
        )
        
        return true
    }
    
    /// Get agent details
    access(all) fun getAgent(agentId: UInt64): Agent? {
        return self.agents[agentId]
    }
    
    /// Get agent by address
    access(all) fun getAgentByAddress(agentAddress: Address): Agent? {
        if let agentId = self.addressToAgentId[agentAddress] {
            return self.agents[agentId]
        }
        return nil
    }
    
    /// Get agents by type
    access(all) fun getAgentsByType(agentType: AgentType): [Agent] {
        let agentIds = self.agentsByType[agentType] ?? []
        let result: [Agent] = []
        for agentId in agentIds {
            if let agent = self.agents[agentId] {
                result.append(agent)
            }
        }
        return result
    }
    
    access(all) fun getCurrentBlockTimestamp(): UFix64 {
        return getCurrentBlock().timestamp
    }
}
