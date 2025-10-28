// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistry
 * @dev Registry for AI agents in Shadow Protocol
 * @notice Manages agent metadata, verification keys, and staking balances
 */
contract AgentRegistry is ReentrancyGuard, Ownable {
    // Agent types
    enum AgentType {
        Provider,
        Buyer,
        Verifier,
        LP,
        MultiRole
    }

    // Agent structure
    struct Agent {
        address agentAddress;
        AgentType agentType;
        string name;
        string description;
        string endpoint; // API endpoint for the agent
        bytes publicKey; // Public key for verification
        uint256 stakeAmount;
        bool active;
        uint256 registeredAt;
        uint256 lastActivity;
        mapping(string => string) metadata; // Additional metadata
    }

    // Events
    event AgentRegistered(
        address indexed agentAddress,
        AgentType indexed agentType,
        string name,
        uint256 timestamp
    );
    
    event AgentUpdated(
        address indexed agentAddress,
        string name,
        uint256 timestamp
    );
    
    event AgentDeactivated(
        address indexed agentAddress,
        uint256 timestamp
    );
    
    event AgentReactivated(
        address indexed agentAddress,
        uint256 timestamp
    );
    
    event StakeUpdated(
        address indexed agentAddress,
        uint256 oldStake,
        uint256 newStake,
        uint256 timestamp
    );
    
    event MetadataUpdated(
        address indexed agentAddress,
        string key,
        string value,
        uint256 timestamp
    );

    // State variables
    mapping(address => Agent) public agents;
    mapping(AgentType => address[]) public agentsByType;
    mapping(address => bool) public isRegistered;
    
    address[] public allAgents;
    
    // External contract addresses
    address public reputationManager;
    address public escrowManager;
    
    // Configuration
    uint256 public constant MIN_STAKE = 0.1 ether;
    uint256 public constant MAX_METADATA_KEYS = 10;
    uint256 public constant MAX_NAME_LENGTH = 50;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 200;
    uint256 public constant MAX_ENDPOINT_LENGTH = 100;

    // Modifiers
    modifier onlyRegisteredAgent() {
        require(isRegistered[msg.sender], "Agent not registered");
        _;
    }

    modifier validAgent(address agentAddress) {
        require(agentAddress != address(0), "Invalid agent address");
        _;
    }

    modifier validAgentType(AgentType agentType) {
        require(uint8(agentType) <= uint8(AgentType.MultiRole), "Invalid agent type");
        _;
    }

    modifier validStringLength(string memory str, uint256 maxLength) {
        require(bytes(str).length <= maxLength, "String too long");
        _;
    }

    constructor() Ownable() {}

    /**
     * @dev Set external contract addresses
     */
    function setExternalContracts(
        address _reputationManager,
        address _escrowManager
    ) external onlyOwner {
        reputationManager = _reputationManager;
        escrowManager = _escrowManager;
    }

    /**
     * @dev Register a new agent
     * @param agentAddress Agent's address
     * @param agentType Type of agent
     * @param name Agent name
     * @param description Agent description
     * @param endpoint API endpoint
     * @param publicKey Public key for verification
     */
    function registerAgent(
        address agentAddress,
        AgentType agentType,
        string calldata name,
        string calldata description,
        string calldata endpoint,
        bytes calldata publicKey
    ) external payable validAgent(agentAddress) validAgentType(agentType) 
      validStringLength(name, MAX_NAME_LENGTH)
      validStringLength(description, MAX_DESCRIPTION_LENGTH)
      validStringLength(endpoint, MAX_ENDPOINT_LENGTH) nonReentrant {
        
        require(!isRegistered[agentAddress], "Agent already registered");
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(publicKey.length > 0, "Invalid public key");

        Agent storage agent = agents[agentAddress];
        agent.agentAddress = agentAddress;
        agent.agentType = agentType;
        agent.name = name;
        agent.description = description;
        agent.endpoint = endpoint;
        agent.publicKey = publicKey;
        agent.stakeAmount = msg.value;
        agent.active = true;
        agent.registeredAt = block.timestamp;
        agent.lastActivity = block.timestamp;

        isRegistered[agentAddress] = true;
        agentsByType[agentType].push(agentAddress);
        allAgents.push(agentAddress);

        emit AgentRegistered(agentAddress, agentType, name, block.timestamp);
    }

    /**
     * @dev Update agent information
     * @param name New name
     * @param description New description
     * @param endpoint New endpoint
     */
    function updateAgent(
        string calldata name,
        string calldata description,
        string calldata endpoint
    ) external onlyRegisteredAgent 
      validStringLength(name, MAX_NAME_LENGTH)
      validStringLength(description, MAX_DESCRIPTION_LENGTH)
      validStringLength(endpoint, MAX_ENDPOINT_LENGTH) {
        
        Agent storage agent = agents[msg.sender];
        agent.name = name;
        agent.description = description;
        agent.endpoint = endpoint;
        agent.lastActivity = block.timestamp;

        emit AgentUpdated(msg.sender, name, block.timestamp);
    }

    /**
     * @dev Update agent metadata
     * @param key Metadata key
     * @param value Metadata value
     */
    function updateMetadata(
        string calldata key,
        string calldata value
    ) external onlyRegisteredAgent {
        require(bytes(key).length > 0, "Invalid key");
        require(bytes(value).length <= 100, "Value too long");
        
        Agent storage agent = agents[msg.sender];
        require(bytes(agent.metadata[key]).length == 0 || bytes(agent.metadata[key]).length > 0, "Too many metadata keys");
        
        agent.metadata[key] = value;
        agent.lastActivity = block.timestamp;

        emit MetadataUpdated(msg.sender, key, value, block.timestamp);
    }

    /**
     * @dev Deactivate an agent
     * @param agentAddress Agent address to deactivate
     */
    function deactivateAgent(address agentAddress) external validAgent(agentAddress) onlyOwner {
        require(isRegistered[agentAddress], "Agent not registered");
        
        Agent storage agent = agents[agentAddress];
        agent.active = false;

        emit AgentDeactivated(agentAddress, block.timestamp);
    }

    /**
     * @dev Reactivate an agent
     * @param agentAddress Agent address to reactivate
     */
    function reactivateAgent(address agentAddress) external validAgent(agentAddress) onlyOwner {
        require(isRegistered[agentAddress], "Agent not registered");
        
        Agent storage agent = agents[agentAddress];
        agent.active = true;
        agent.lastActivity = block.timestamp;

        emit AgentReactivated(agentAddress, block.timestamp);
    }

    /**
     * @dev Update agent stake
     * @param agentAddress Agent address
     * @param newStake New stake amount
     */
    function updateStake(address agentAddress, uint256 newStake) external validAgent(agentAddress) onlyOwner {
        require(isRegistered[agentAddress], "Agent not registered");
        require(newStake >= MIN_STAKE, "Insufficient stake");
        
        Agent storage agent = agents[agentAddress];
        uint256 oldStake = agent.stakeAmount;
        agent.stakeAmount = newStake;

        emit StakeUpdated(agentAddress, oldStake, newStake, block.timestamp);
    }

    /**
     * @dev Get agent details
     * @param agentAddress Agent address
     * @return Agent struct (without metadata mapping)
     */
    function getAgent(address agentAddress) external view validAgent(agentAddress) returns (
        address,
        AgentType,
        string memory,
        string memory,
        string memory,
        bytes memory,
        uint256,
        bool,
        uint256,
        uint256
    ) {
        Agent storage agent = agents[agentAddress];
        return (
            agent.agentAddress,
            agent.agentType,
            agent.name,
            agent.description,
            agent.endpoint,
            agent.publicKey,
            agent.stakeAmount,
            agent.active,
            agent.registeredAt,
            agent.lastActivity
        );
    }

    /**
     * @dev Get agent metadata
     * @param agentAddress Agent address
     * @param key Metadata key
     * @return Metadata value
     */
    function getAgentMetadata(address agentAddress, string calldata key) external view validAgent(agentAddress) returns (string memory) {
        return agents[agentAddress].metadata[key];
    }

    /**
     * @dev Get agents by type
     * @param agentType Agent type
     * @return Array of agent addresses
     */
    function getAgentsByType(AgentType agentType) external view validAgentType(agentType) returns (address[] memory) {
        return agentsByType[agentType];
    }

    /**
     * @dev Get all agents
     * @return Array of all agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return allAgents;
    }

    /**
     * @dev Get active agents by type
     * @param agentType Agent type
     * @return Array of active agent addresses
     */
    function getActiveAgentsByType(AgentType agentType) external view validAgentType(agentType) returns (address[] memory) {
        address[] memory typeAgents = agentsByType[agentType];
        address[] memory activeAgents = new address[](typeAgents.length);
        uint256 activeCount = 0;

        for (uint256 i = 0; i < typeAgents.length; i++) {
            if (agents[typeAgents[i]].active) {
                activeAgents[activeCount] = typeAgents[i];
                activeCount++;
            }
        }

        // Resize array to actual active count
        address[] memory result = new address[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeAgents[i];
        }

        return result;
    }

    /**
     * @dev Check if agent is active
     * @param agentAddress Agent address
     * @return True if agent is active
     */
    function isAgentActive(address agentAddress) external view validAgent(agentAddress) returns (bool) {
        return agents[agentAddress].active;
    }

    /**
     * @dev Get total agent count
     * @return Total number of registered agents
     */
    function getTotalAgentCount() external view returns (uint256) {
        return allAgents.length;
    }

    /**
     * @dev Get agent count by type
     * @param agentType Agent type
     * @return Number of agents of this type
     */
    function getAgentCountByType(AgentType agentType) external view validAgentType(agentType) returns (uint256) {
        return agentsByType[agentType].length;
    }

    /**
     * @dev Update last activity timestamp
     * @param agentAddress Agent address
     */
    function updateLastActivity(address agentAddress) external validAgent(agentAddress) onlyOwner {
        agents[agentAddress].lastActivity = block.timestamp;
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
