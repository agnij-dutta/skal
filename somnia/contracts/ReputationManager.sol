// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ReputationManager
 * @dev Manages reputation scores and staking for Shadow Protocol
 * @notice Handles provider/verifier reputation, slashing, and stake management
 */
contract ReputationManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Reputation structure
    struct Reputation {
        uint256 score; // 0-1000 scale
        uint256 totalTasks;
        uint256 successfulTasks;
        uint256 disputedTasks;
        uint256 stakeAmount;
        uint256 lastUpdate;
        bool active;
    }

    // Stake structure
    struct Stake {
        uint256 amount;
        uint256 timestamp;
        bool locked;
        uint256 unlockTime;
    }

    // Events
    event ReputationUpdated(
        address indexed user,
        uint256 oldScore,
        uint256 newScore,
        uint256 timestamp
    );
    
    event StakeDeposited(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event StakeWithdrawn(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event StakeSlashed(
        address indexed user,
        uint256 amount,
        string reason,
        uint256 timestamp
    );
    
    event UserActivated(
        address indexed user,
        uint256 initialScore,
        uint256 timestamp
    );
    
    event UserDeactivated(
        address indexed user,
        uint256 timestamp
    );

    // State variables
    mapping(address => Reputation) public reputations;
    mapping(address => Stake) public stakes;
    mapping(address => bool) public authorizedUpdaters;
    
    // External contract addresses
    address public commitRegistry;
    address public escrowManager;
    address public ammEngine;
    
    // Configuration
    uint256 public constant MAX_REPUTATION = 1000;
    uint256 public constant MIN_REPUTATION = 0;
    uint256 public constant INITIAL_REPUTATION = 500;
    uint256 public constant MIN_STAKE = 0.1 ether;
    uint256 public constant STAKE_LOCK_TIME = 7 days;
    uint256 public constant SLASH_PERCENT = 10; // 10% of stake slashed per violation
    
    // Reputation calculation weights
    uint256 public constant SUCCESS_WEIGHT = 10;
    uint256 public constant DISPUTE_PENALTY = 50;
    uint256 public constant TIME_DECAY_FACTOR = 1; // Reputation decays over time

    // Modifiers
    modifier onlyAuthorizedUpdater() {
        require(authorizedUpdaters[msg.sender], "Not authorized updater");
        _;
    }

    modifier validUser(address user) {
        require(user != address(0), "Invalid user address");
        _;
    }

    modifier hasStake(address user) {
        require(stakes[user].amount >= MIN_STAKE, "Insufficient stake");
        _;
    }

    constructor() Ownable() {
        // Owner is automatically an authorized updater
        authorizedUpdaters[msg.sender] = true;
    }

    /**
     * @dev Set external contract addresses
     */
    function setExternalContracts(
        address _commitRegistry,
        address _escrowManager,
        address _ammEngine
    ) external onlyOwner {
        commitRegistry = _commitRegistry;
        escrowManager = _escrowManager;
        ammEngine = _ammEngine;
    }

    /**
     * @dev Add authorized updater
     * @param updater Address to authorize
     */
    function addAuthorizedUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = true;
    }

    /**
     * @dev Remove authorized updater
     * @param updater Address to remove authorization
     */
    function removeAuthorizedUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = false;
    }

    /**
     * @dev Activate a user (called when they first stake)
     * @param user User address
     */
    function activateUser(address user) external validUser(user) onlyAuthorizedUpdater {
        require(!reputations[user].active, "User already active");
        
        reputations[user] = Reputation({
            score: INITIAL_REPUTATION,
            totalTasks: 0,
            successfulTasks: 0,
            disputedTasks: 0,
            stakeAmount: 0,
            lastUpdate: block.timestamp,
            active: true
        });

        emit UserActivated(user, INITIAL_REPUTATION, block.timestamp);
    }

    /**
     * @dev Deactivate a user
     * @param user User address
     */
    function deactivateUser(address user) external validUser(user) onlyAuthorizedUpdater {
        require(reputations[user].active, "User not active");
        
        reputations[user].active = false;
        
        emit UserDeactivated(user, block.timestamp);
    }

    /**
     * @dev Deposit stake for a user
     * @param user User address
     * @param amount Amount to stake
     */
    function depositStake(address user, uint256 amount) external payable validUser(user) nonReentrant {
        require(msg.value == amount, "Amount mismatch");
        require(amount >= MIN_STAKE, "Insufficient stake amount");

        if (!reputations[user].active) {
            // Activate user inline
            reputations[user] = Reputation({
                score: INITIAL_REPUTATION,
                totalTasks: 0,
                successfulTasks: 0,
                disputedTasks: 0,
                stakeAmount: 0,
                lastUpdate: block.timestamp,
                active: true
            });
        }

        stakes[user].amount += amount;
        stakes[user].timestamp = block.timestamp;
        stakes[user].locked = true;
        stakes[user].unlockTime = block.timestamp + STAKE_LOCK_TIME;

        reputations[user].stakeAmount += amount;

        emit StakeDeposited(user, amount, block.timestamp);
    }

    /**
     * @dev Withdraw stake (only after lock time)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        address user = msg.sender;
        require(stakes[user].amount >= amount, "Insufficient stake");
        require(block.timestamp >= stakes[user].unlockTime, "Stake still locked");
        require(!stakes[user].locked, "Stake is locked");

        stakes[user].amount -= amount;
        reputations[user].stakeAmount -= amount;

        payable(user).transfer(amount);

        emit StakeWithdrawn(user, amount, block.timestamp);
    }

    /**
     * @dev Unlock stake (after lock time)
     */
    function unlockStake() external {
        address user = msg.sender;
        require(block.timestamp >= stakes[user].unlockTime, "Stake still locked");
        require(stakes[user].locked, "Stake already unlocked");

        stakes[user].locked = false;
    }

    /**
     * @dev Update reputation based on task outcome
     * @param user User address
     * @param success Whether the task was successful
     * @param disputed Whether the task was disputed
     */
    function updateReputation(
        address user,
        bool success,
        bool disputed
    ) external validUser(user) onlyAuthorizedUpdater {
        require(reputations[user].active, "User not active");

        Reputation storage rep = reputations[user];
        uint256 oldScore = rep.score;

        // Update task counts
        rep.totalTasks++;
        if (success) {
            rep.successfulTasks++;
        }
        if (disputed) {
            rep.disputedTasks++;
        }

        // Calculate new score
        uint256 newScore = calculateReputationScore(rep);
        
        // Apply bounds
        if (newScore > MAX_REPUTATION) {
            newScore = MAX_REPUTATION;
        } else if (newScore < MIN_REPUTATION) {
            newScore = MIN_REPUTATION;
        }

        rep.score = newScore;
        rep.lastUpdate = block.timestamp;

        emit ReputationUpdated(user, oldScore, newScore, block.timestamp);
    }

    /**
     * @dev Slash stake for bad behavior
     * @param user User address
     * @param reason Reason for slashing
     */
    function slashStake(
        address user,
        string calldata reason
    ) external validUser(user) onlyAuthorizedUpdater {
        require(stakes[user].amount > 0, "No stake to slash");

        uint256 slashAmount = (stakes[user].amount * SLASH_PERCENT) / 100;
        if (slashAmount > stakes[user].amount) {
            slashAmount = stakes[user].amount;
        }

        stakes[user].amount -= slashAmount;
        reputations[user].stakeAmount -= slashAmount;

        // Reduce reputation significantly
        uint256 oldScore = reputations[user].score;
        uint256 newScore = oldScore > DISPUTE_PENALTY ? oldScore - DISPUTE_PENALTY : MIN_REPUTATION;
        reputations[user].score = newScore;

        // Transfer slashed amount to contract (could be burned or sent to treasury)
        payable(address(this)).transfer(slashAmount);

        emit StakeSlashed(user, slashAmount, reason, block.timestamp);
        emit ReputationUpdated(user, oldScore, newScore, block.timestamp);
    }

    /**
     * @dev Calculate reputation score based on performance
     * @param rep Reputation struct
     * @return Calculated score
     */
    function calculateReputationScore(Reputation memory rep) internal pure returns (uint256) {
        if (rep.totalTasks == 0) {
            return INITIAL_REPUTATION;
        }

        // Success rate calculation
        uint256 successRate = (rep.successfulTasks * 100) / rep.totalTasks;
        
        // Dispute penalty
        uint256 disputePenalty = rep.disputedTasks * DISPUTE_PENALTY;
        
        // Base score from success rate
        uint256 baseScore = (successRate * MAX_REPUTATION) / 100;
        
        // Apply dispute penalty
        uint256 finalScore = baseScore > disputePenalty ? baseScore - disputePenalty : MIN_REPUTATION;
        
        return finalScore;
    }

    /**
     * @dev Get reputation details
     * @param user User address
     * @return Reputation struct
     */
    function getReputation(address user) external view validUser(user) returns (Reputation memory) {
        return reputations[user];
    }

    /**
     * @dev Get stake details
     * @param user User address
     * @return Stake struct
     */
    function getStake(address user) external view validUser(user) returns (Stake memory) {
        return stakes[user];
    }

    /**
     * @dev Check if user can perform actions (has sufficient reputation and stake)
     * @param user User address
     * @return True if user can perform actions
     */
    function canPerformAction(address user) external view validUser(user) returns (bool) {
        return reputations[user].active && 
               reputations[user].score >= 300 && // Minimum reputation threshold
               stakes[user].amount >= MIN_STAKE;
    }

    /**
     * @dev Get required stake amount based on reputation
     * @param user User address
     * @return Required stake amount
     */
    function getRequiredStake(address user) external view validUser(user) returns (uint256) {
        if (!reputations[user].active) {
            return MIN_STAKE;
        }

        // Higher reputation = lower required stake
        uint256 reputationFactor = MAX_REPUTATION - reputations[user].score;
        uint256 requiredStake = MIN_STAKE + (reputationFactor * MIN_STAKE) / MAX_REPUTATION;
        
        return requiredStake;
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
