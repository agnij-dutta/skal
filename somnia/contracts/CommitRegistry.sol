// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CommitRegistry
 * @dev Manages commit-reveal cycles for AI intelligence trading
 * @notice This contract handles the core commit-reveal mechanism for Shadow Protocol
 */
contract CommitRegistry is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    // Task states
    enum TaskState {
        Committed,
        Revealed,
        Validated,
        Settled,
        Disputed,
        Cancelled
    }

    // Task structure
    struct Task {
        bytes32 commitHash;
        address provider;
        uint256 marketId;
        uint256 stake;
        uint256 timestamp;
        TaskState state;
        string cid; // IPFS CID for revealed data
        uint8 validationScore;
        address verifier;
        uint256 revealDeadline;
        uint256 validationDeadline;
    }

    // Events
    event TaskCommitted(
        uint256 indexed taskId,
        bytes32 indexed commitHash,
        address indexed provider,
        uint256 marketId,
        uint256 stake,
        uint256 timestamp
    );
    
    event TaskRevealed(
        uint256 indexed taskId,
        string cid,
        uint256 timestamp
    );
    
    event TaskValidated(
        uint256 indexed taskId,
        uint8 score,
        address indexed verifier,
        uint256 timestamp
    );
    
    event TaskSettled(
        uint256 indexed taskId,
        address indexed provider,
        uint256 payout,
        uint256 timestamp
    );
    
    event TaskDisputed(
        uint256 indexed taskId,
        address indexed disputer,
        uint256 timestamp
    );

    // State variables
    Counters.Counter private _taskIdCounter;
    mapping(uint256 => Task) public tasks;
    mapping(address => uint256[]) public providerTasks;
    mapping(uint256 => uint256[]) public marketTasks;
    
    // Configuration
    uint256 public constant COMMIT_WINDOW = 1 hours;
    uint256 public constant REVEAL_WINDOW = 24 hours;
    uint256 public constant VALIDATION_WINDOW = 2 hours;
    uint256 public constant MIN_STAKE = 0.01 ether;
    
    // External contract addresses
    address public escrowManager;
    address public reputationManager;
    address public agentRegistry;

    // Modifiers
    modifier onlyEscrowManager() {
        require(msg.sender == escrowManager, "Only EscrowManager");
        _;
    }

    modifier onlyRegisteredAgent() {
        require(agentRegistry != address(0), "AgentRegistry not set");
        // TODO: Add agent verification logic
        _;
    }

    modifier validTaskId(uint256 taskId) {
        require(taskId < _taskIdCounter.current(), "Invalid task ID");
        _;
    }

    constructor() Ownable() {}

    /**
     * @dev Set external contract addresses
     */
    function setExternalContracts(
        address _escrowManager,
        address _reputationManager,
        address _agentRegistry
    ) external onlyOwner {
        escrowManager = _escrowManager;
        reputationManager = _reputationManager;
        agentRegistry = _agentRegistry;
    }

    /**
     * @dev Commit a task with encrypted data hash
     * @param commitHash Hash of encrypted data + metadata
     * @param marketId Market category ID
     * @param stake Provider's stake amount
     */
    function commitTask(
        bytes32 commitHash,
        uint256 marketId,
        uint256 stake
    ) external payable nonReentrant returns (uint256) {
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(stake == msg.value, "Stake mismatch");
        require(commitHash != bytes32(0), "Invalid commit hash");
        require(marketId > 0, "Invalid market ID");

        uint256 taskId = _taskIdCounter.current();
        _taskIdCounter.increment();

        Task storage task = tasks[taskId];
        task.commitHash = commitHash;
        task.provider = msg.sender;
        task.marketId = marketId;
        task.stake = stake;
        task.timestamp = block.timestamp;
        task.state = TaskState.Committed;
        task.revealDeadline = block.timestamp + REVEAL_WINDOW;

        providerTasks[msg.sender].push(taskId);
        marketTasks[marketId].push(taskId);

        emit TaskCommitted(taskId, commitHash, msg.sender, marketId, stake, block.timestamp);

        return taskId;
    }

    /**
     * @dev Reveal the encrypted data by providing IPFS CID
     * @param taskId Task ID to reveal
     * @param cid IPFS CID of the encrypted data
     */
    function revealTask(
        uint256 taskId,
        string calldata cid
    ) external validTaskId(taskId) nonReentrant {
        Task storage task = tasks[taskId];
        
        require(task.state == TaskState.Committed, "Task not in committed state");
        require(task.provider == msg.sender, "Only provider can reveal");
        require(block.timestamp <= task.revealDeadline, "Reveal deadline passed");
        require(bytes(cid).length > 0, "Invalid CID");

        task.cid = cid;
        task.state = TaskState.Revealed;
        task.validationDeadline = block.timestamp + VALIDATION_WINDOW;

        emit TaskRevealed(taskId, cid, block.timestamp);
    }

    /**
     * @dev Finalize validation with verifier attestation
     * @param taskId Task ID to validate
     * @param score Validation score (0-100)
     * @param verifier Verifier address
     * @param signature Verifier's signature
     */
    function finalizeValidation(
        uint256 taskId,
        uint8 score,
        address verifier,
        bytes calldata signature
    ) external validTaskId(taskId) onlyRegisteredAgent nonReentrant {
        Task storage task = tasks[taskId];
        
        require(task.state == TaskState.Revealed, "Task not revealed");
        require(block.timestamp <= task.validationDeadline, "Validation deadline passed");
        require(score <= 100, "Invalid score");
        require(verifier != address(0), "Invalid verifier");

        // TODO: Verify signature against verifier's public key
        // For now, we'll trust the caller is a registered verifier

        task.validationScore = score;
        task.verifier = verifier;
        task.state = TaskState.Validated;

        emit TaskValidated(taskId, score, verifier, block.timestamp);

        // Trigger settlement in EscrowManager
        if (escrowManager != address(0)) {
            // Call EscrowManager to release funds based on validation
            // This will be implemented in EscrowManager contract
        }
    }

    /**
     * @dev Settle a validated task
     * @param taskId Task ID to settle
     */
    function settleTask(uint256 taskId) external validTaskId(taskId) onlyEscrowManager {
        Task storage task = tasks[taskId];
        
        require(task.state == TaskState.Validated, "Task not validated");

        task.state = TaskState.Settled;

        emit TaskSettled(taskId, task.provider, task.stake, block.timestamp);
    }

    /**
     * @dev Initiate dispute for a task
     * @param taskId Task ID to dispute
     */
    function initiateDispute(uint256 taskId) external validTaskId(taskId) {
        Task storage task = tasks[taskId];
        
        require(
            task.state == TaskState.Validated || task.state == TaskState.Revealed,
            "Cannot dispute task in current state"
        );
        require(block.timestamp <= task.validationDeadline + 1 hours, "Dispute window closed");

        task.state = TaskState.Disputed;

        emit TaskDisputed(taskId, msg.sender, block.timestamp);
    }

    /**
     * @dev Get task details
     * @param taskId Task ID
     * @return Task struct
     */
    function getTask(uint256 taskId) external view validTaskId(taskId) returns (Task memory) {
        return tasks[taskId];
    }

    /**
     * @dev Get tasks by provider
     * @param provider Provider address
     * @return Array of task IDs
     */
    function getProviderTasks(address provider) external view returns (uint256[] memory) {
        return providerTasks[provider];
    }

    /**
     * @dev Get tasks by market
     * @param marketId Market ID
     * @return Array of task IDs
     */
    function getMarketTasks(uint256 marketId) external view returns (uint256[] memory) {
        return marketTasks[marketId];
    }

    /**
     * @dev Get total task count
     * @return Total number of tasks
     */
    function getTotalTasks() external view returns (uint256) {
        return _taskIdCounter.current();
    }

    /**
     * @dev Check if task can be revealed
     * @param taskId Task ID
     * @return True if task can be revealed
     */
    function canReveal(uint256 taskId) external view validTaskId(taskId) returns (bool) {
        Task storage task = tasks[taskId];
        return task.state == TaskState.Committed && block.timestamp <= task.revealDeadline;
    }

    /**
     * @dev Check if task can be validated
     * @param taskId Task ID
     * @return True if task can be validated
     */
    function canValidate(uint256 taskId) external view validTaskId(taskId) returns (bool) {
        Task storage task = tasks[taskId];
        return task.state == TaskState.Revealed && block.timestamp <= task.validationDeadline;
    }
}
