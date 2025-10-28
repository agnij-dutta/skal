// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OracleRegistry
 * @dev Registry for decentralized oracle nodes in Shadow Protocol
 * @notice Manages oracle registration, staking, and reputation
 */
contract OracleRegistry is ReentrancyGuard, Ownable {
    struct Oracle {
        address oracleAddress;
        uint256 stake;
        uint256 reputation; // 0-100 score
        bool active;
        uint256 successfulValidations;
        uint256 totalValidations;
        uint256 registeredAt;
        uint256 lastActivity;
    }

    // Events
    event OracleRegistered(
        address indexed oracleAddress,
        uint256 stake,
        uint256 timestamp
    );
    
    event OracleDeactivated(
        address indexed oracleAddress,
        uint256 timestamp
    );
    
    event OracleSlashed(
        address indexed oracleAddress,
        uint256 slashAmount,
        string reason,
        uint256 timestamp
    );
    
    event ReputationUpdated(
        address indexed oracleAddress,
        uint256 oldReputation,
        uint256 newReputation,
        uint256 timestamp
    );
    
    event StakeIncreased(
        address indexed oracleAddress,
        uint256 addedStake,
        uint256 totalStake,
        uint256 timestamp
    );

    // State variables
    mapping(address => Oracle) public oracles;
    address[] public activeOracles;
    mapping(address => bool) public isRegisteredOracle;
    
    // Configuration
    uint256 public constant MIN_ORACLE_STAKE = 0.1 ether;
    uint256 public constant MIN_ORACLES_FOR_CONSENSUS = 3;
    uint256 public constant SLASH_PERCENTAGE = 10; // 10% slash for malicious behavior
    uint256 public constant REPUTATION_DECAY_RATE = 1; // Reputation decay per failed validation
    
    address public verificationAggregator;

    // Modifiers
    modifier onlyRegisteredOracle() {
        require(isRegisteredOracle[msg.sender], "Not a registered oracle");
        require(oracles[msg.sender].active, "Oracle not active");
        _;
    }

    modifier onlyAggregator() {
        require(msg.sender == verificationAggregator, "Only aggregator can call");
        _;
    }

    constructor() Ownable() {}

    /**
     * @dev Set verification aggregator address
     * @param _aggregator Aggregator contract address
     */
    function setVerificationAggregator(address _aggregator) external onlyOwner {
        require(_aggregator != address(0), "Invalid aggregator");
        verificationAggregator = _aggregator;
    }

    /**
     * @dev Register as an oracle node
     */
    function registerOracle() external payable nonReentrant {
        require(!isRegisteredOracle[msg.sender], "Already registered");
        require(msg.value >= MIN_ORACLE_STAKE, "Insufficient stake");

        Oracle storage oracle = oracles[msg.sender];
        oracle.oracleAddress = msg.sender;
        oracle.stake = msg.value;
        oracle.reputation = 50; // Start with neutral reputation
        oracle.active = true;
        oracle.successfulValidations = 0;
        oracle.totalValidations = 0;
        oracle.registeredAt = block.timestamp;
        oracle.lastActivity = block.timestamp;

        isRegisteredOracle[msg.sender] = true;
        activeOracles.push(msg.sender);

        emit OracleRegistered(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Deactivate oracle (can only deactivate own oracle)
     */
    function deactivateOracle() external onlyRegisteredOracle nonReentrant {
        Oracle storage oracle = oracles[msg.sender];
        oracle.active = false;

        // Remove from active oracles array
        for (uint256 i = 0; i < activeOracles.length; i++) {
            if (activeOracles[i] == msg.sender) {
                activeOracles[i] = activeOracles[activeOracles.length - 1];
                activeOracles.pop();
                break;
            }
        }

        // Return stake
        uint256 stakeToReturn = oracle.stake;
        oracle.stake = 0;
        
        (bool success, ) = msg.sender.call{value: stakeToReturn}("");
        require(success, "Stake return failed");

        emit OracleDeactivated(msg.sender, block.timestamp);
    }

    /**
     * @dev Increase oracle stake
     */
    function increaseStake() external payable onlyRegisteredOracle {
        require(msg.value > 0, "No stake provided");
        
        Oracle storage oracle = oracles[msg.sender];
        oracle.stake += msg.value;

        emit StakeIncreased(msg.sender, msg.value, oracle.stake, block.timestamp);
    }

    /**
     * @dev Update oracle reputation after validation
     * @param oracleAddress Oracle to update
     * @param success Whether validation was successful
     */
    function updateReputation(address oracleAddress, bool success) external onlyAggregator {
        require(isRegisteredOracle[oracleAddress], "Oracle not registered");
        
        Oracle storage oracle = oracles[oracleAddress];
        uint256 oldReputation = oracle.reputation;
        
        oracle.totalValidations++;
        oracle.lastActivity = block.timestamp;
        
        if (success) {
            oracle.successfulValidations++;
            // Increase reputation (max 100)
            if (oracle.reputation < 100) {
                oracle.reputation = oracle.reputation + 5 > 100 ? 100 : oracle.reputation + 5;
            }
        } else {
            // Decrease reputation (min 0)
            if (oracle.reputation > REPUTATION_DECAY_RATE) {
                oracle.reputation -= REPUTATION_DECAY_RATE;
            } else {
                oracle.reputation = 0;
            }
        }

        emit ReputationUpdated(oracleAddress, oldReputation, oracle.reputation, block.timestamp);
    }

    /**
     * @dev Slash oracle for malicious behavior
     * @param oracleAddress Oracle to slash
     * @param reason Reason for slashing
     */
    function slashOracle(address oracleAddress, string calldata reason) external onlyAggregator {
        require(isRegisteredOracle[oracleAddress], "Oracle not registered");
        
        Oracle storage oracle = oracles[oracleAddress];
        uint256 slashAmount = (oracle.stake * SLASH_PERCENTAGE) / 100;
        
        oracle.stake -= slashAmount;
        oracle.reputation = oracle.reputation > 20 ? oracle.reputation - 20 : 0;

        // Send slashed amount to owner (protocol treasury)
        (bool success, ) = owner().call{value: slashAmount}("");
        require(success, "Slash transfer failed");

        emit OracleSlashed(oracleAddress, slashAmount, reason, block.timestamp);

        // Deactivate if stake falls below minimum
        if (oracle.stake < MIN_ORACLE_STAKE) {
            oracle.active = false;
            // Remove from active oracles
            for (uint256 i = 0; i < activeOracles.length; i++) {
                if (activeOracles[i] == oracleAddress) {
                    activeOracles[i] = activeOracles[activeOracles.length - 1];
                    activeOracles.pop();
                    break;
                }
            }
        }
    }

    /**
     * @dev Get all active oracles
     * @return Array of active oracle addresses
     */
    function getActiveOracles() external view returns (address[] memory) {
        return activeOracles;
    }

    /**
     * @dev Get oracle details
     * @param oracleAddress Oracle address
     * @return Oracle struct data
     */
    function getOracle(address oracleAddress) external view returns (
        address,
        uint256,
        uint256,
        bool,
        uint256,
        uint256,
        uint256,
        uint256
    ) {
        Oracle storage oracle = oracles[oracleAddress];
        return (
            oracle.oracleAddress,
            oracle.stake,
            oracle.reputation,
            oracle.active,
            oracle.successfulValidations,
            oracle.totalValidations,
            oracle.registeredAt,
            oracle.lastActivity
        );
    }

    /**
     * @dev Get active oracle count
     * @return Number of active oracles
     */
    function getActiveOracleCount() external view returns (uint256) {
        return activeOracles.length;
    }

    /**
     * @dev Check if address is active oracle
     * @param oracleAddress Address to check
     * @return True if active oracle
     */
    function isActiveOracle(address oracleAddress) external view returns (bool) {
        return isRegisteredOracle[oracleAddress] && oracles[oracleAddress].active;
    }

    /**
     * @dev Get oracle success rate
     * @param oracleAddress Oracle address
     * @return Success rate percentage (0-100)
     */
    function getOracleSuccessRate(address oracleAddress) external view returns (uint256) {
        Oracle storage oracle = oracles[oracleAddress];
        if (oracle.totalValidations == 0) return 0;
        return (oracle.successfulValidations * 100) / oracle.totalValidations;
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}


