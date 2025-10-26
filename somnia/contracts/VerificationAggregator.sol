// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interface for CommitRegistry integration
interface ICommitRegistry {
    function finalizeValidation(
        uint256 taskId,
        uint8 score,
        address verifier,
        bytes calldata signature
    ) external;
    
    function settleTask(uint256 taskId) external;
}

// Interface for EscrowManager integration
interface IEscrowManager {
    function releaseFunds(
        uint256 taskId,
        address provider,
        uint8 validationScore
    ) external;
    
    function refundFunds(uint256 taskId) external;
}

/**
 * @title VerificationAggregator
 * @dev Collects verification submissions from multiple oracles and determines consensus
 * @notice Implements multi-signature consensus for AI data marketplace verification
 */
contract VerificationAggregator is ReentrancyGuard, Ownable {
    struct VerificationSubmission {
        address verifier;
        uint8 score;
        bytes signature;
        uint256 timestamp;
        bool counted;
    }

    struct TaskVerification {
        uint256 taskId;
        uint256 startTime;
        uint256 submissionCount;
        bool consensusReached;
        bool finalized;
        uint8 finalScore;
        address[] verifiers;
        mapping(address => VerificationSubmission) submissions;
    }

    // Events
    event VerificationSubmitted(
        uint256 indexed taskId,
        address indexed verifier,
        uint8 score,
        uint256 timestamp
    );
    
    event ConsensusReached(
        uint256 indexed taskId,
        uint8 finalScore,
        uint256 submissionCount,
        uint256 timestamp
    );
    
    event TaskFinalized(
        uint256 indexed taskId,
        uint8 finalScore,
        address[] verifiers,
        uint256 timestamp
    );

    // State variables
    mapping(uint256 => TaskVerification) public taskVerifications;
    address public oracleRegistry;
    address public commitRegistry;
    address public escrowManager;
    
    // Configuration
    uint256 public constant CONSENSUS_THRESHOLD = 2; // 2 out of 3 oracles must agree
    uint256 public constant SUBMISSION_WINDOW = 5 minutes; // 5-minute submission window
    uint256 public constant SCORE_VARIANCE_TOLERANCE = 15; // 15% variance allowed
    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MIN_SCORE = 0;

    // Modifiers
    modifier onlyRegisteredOracle() {
        require(oracleRegistry != address(0), "OracleRegistry not set");
        // TODO: Add oracle registry check when available
        _;
    }

    modifier validTaskId(uint256 taskId) {
        require(taskId > 0, "Invalid task ID");
        _;
    }

    modifier withinSubmissionWindow(uint256 taskId) {
        TaskVerification storage task = taskVerifications[taskId];
        require(
            block.timestamp <= task.startTime + SUBMISSION_WINDOW,
            "Submission window expired"
        );
        _;
    }

    constructor(address _oracleRegistry, address _commitRegistry) Ownable() {
        require(_oracleRegistry != address(0), "Invalid oracle registry");
        require(_commitRegistry != address(0), "Invalid commit registry");
        
        oracleRegistry = _oracleRegistry;
        commitRegistry = _commitRegistry;
    }

    /**
     * @dev Submit verification score for a task
     * @param taskId Task ID to verify
     * @param score Verification score (0-100)
     * @param signature Oracle's signature of the score
     */
    function submitVerification(
        uint256 taskId,
        uint8 score,
        bytes calldata signature
    ) external onlyRegisteredOracle validTaskId(taskId) withinSubmissionWindow(taskId) nonReentrant {
        require(score >= MIN_SCORE && score <= MAX_SCORE, "Invalid score range");
        
        TaskVerification storage task = taskVerifications[taskId];
        
        // Initialize task if first submission
        if (task.startTime == 0) {
            task.taskId = taskId;
            task.startTime = block.timestamp;
        }
        
        // Check if oracle already submitted
        require(
            task.submissions[msg.sender].timestamp == 0,
            "Already submitted for this task"
        );
        
        // Store submission
        task.submissions[msg.sender] = VerificationSubmission({
            verifier: msg.sender,
            score: score,
            signature: signature,
            timestamp: block.timestamp,
            counted: false
        });
        
        task.submissionCount++;
        task.verifiers.push(msg.sender);
        
        emit VerificationSubmitted(taskId, msg.sender, score, block.timestamp);
        
        // Check for consensus
        _checkConsensus(taskId);
    }

    /**
     * @dev Check if consensus has been reached for a task
     * @param taskId Task ID to check
     */
    function _checkConsensus(uint256 taskId) internal {
        TaskVerification storage task = taskVerifications[taskId];
        
        if (task.consensusReached || task.finalized) {
            return;
        }
        
        // Need at least 2 submissions for consensus
        if (task.submissionCount < CONSENSUS_THRESHOLD) {
            return;
        }
        
        // Calculate median score
        uint8[] memory scores = new uint8[](task.submissionCount);
        uint256 validCount = 0;
        
        for (uint256 i = 0; i < task.verifiers.length; i++) {
            address verifier = task.verifiers[i];
            if (task.submissions[verifier].timestamp > 0) {
                scores[validCount] = task.submissions[verifier].score;
                validCount++;
            }
        }
        
        if (validCount < CONSENSUS_THRESHOLD) {
            return;
        }
        
        // Sort scores to find median
        _sortScores(scores, validCount);
        uint8 medianScore = scores[validCount / 2];
        
        // Check if enough scores are within tolerance
        uint256 consensusCount = 0;
        for (uint256 i = 0; i < validCount; i++) {
            uint8 score = scores[i];
            uint256 variance = _calculateVariance(score, medianScore);
            if (variance <= SCORE_VARIANCE_TOLERANCE) {
                consensusCount++;
            }
        }
        
        // Consensus reached if at least 2 scores are within tolerance
        if (consensusCount >= CONSENSUS_THRESHOLD) {
            task.consensusReached = true;
            task.finalScore = medianScore;
            
            emit ConsensusReached(taskId, medianScore, task.submissionCount, block.timestamp);
            
            // Finalize the task and trigger settlement
            _finalizeTask(taskId);
        }
    }

    /**
     * @dev Finalize task verification and trigger settlement
     * @param taskId Task ID to finalize
     */
    function _finalizeTask(uint256 taskId) internal {
        TaskVerification storage task = taskVerifications[taskId];
        
        if (task.finalized) {
            return;
        }
        
        task.finalized = true;
        
        // Submit final score to CommitRegistry to trigger settlement
        if (commitRegistry != address(0)) {
            ICommitRegistry(commitRegistry).finalizeValidation(
                taskId,
                task.finalScore,
                address(this), // VerificationAggregator as verifier
                "" // Empty signature for now
            );
        }
        
        emit TaskFinalized(taskId, task.finalScore, task.verifiers, block.timestamp);
    }

    /**
     * @dev Get submission count for a task
     * @param taskId Task ID
     * @return Number of submissions
     */
    function getSubmissionCount(uint256 taskId) external view returns (uint256) {
        return taskVerifications[taskId].submissionCount;
    }

    /**
     * @dev Check if consensus has been reached for a task
     * @param taskId Task ID
     * @return True if consensus reached
     */
    function hasConsensus(uint256 taskId) external view returns (bool) {
        return taskVerifications[taskId].consensusReached;
    }

    /**
     * @dev Get time remaining for submissions
     * @param taskId Task ID
     * @return Seconds remaining in submission window
     */
    function getTimeRemaining(uint256 taskId) external view returns (uint256) {
        TaskVerification storage task = taskVerifications[taskId];
        if (task.startTime == 0) {
            return SUBMISSION_WINDOW;
        }
        
        uint256 elapsed = block.timestamp - task.startTime;
        if (elapsed >= SUBMISSION_WINDOW) {
            return 0;
        }
        
        return SUBMISSION_WINDOW - elapsed;
    }

    /**
     * @dev Check if task is finalized
     * @param taskId Task ID
     * @return True if finalized
     */
    function taskFinalized(uint256 taskId) external view returns (bool) {
        return taskVerifications[taskId].finalized;
    }

    /**
     * @dev Get all submissions for a task
     * @param taskId Task ID
     * @return Array of submission data
     */
    function getTaskSubmissions(uint256 taskId) external view returns (
        VerificationSubmission[] memory
    ) {
        TaskVerification storage task = taskVerifications[taskId];
        VerificationSubmission[] memory submissions = new VerificationSubmission[](task.submissionCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < task.verifiers.length; i++) {
            address verifier = task.verifiers[i];
            if (task.submissions[verifier].timestamp > 0) {
                submissions[index] = task.submissions[verifier];
                index++;
            }
        }
        
        return submissions;
    }

    /**
     * @dev Get task verification details
     * @param taskId Task ID
     * @return startTime Start time of verification
     * @return submissionCount Number of submissions
     * @return consensusReached Whether consensus was reached
     * @return finalized Whether task is finalized
     * @return finalScore Final consensus score
     * @return verifiers Array of verifier addresses
     */
    function getTaskVerification(uint256 taskId) external view returns (
        uint256 startTime,
        uint256 submissionCount,
        bool consensusReached,
        bool finalized,
        uint8 finalScore,
        address[] memory verifiers
    ) {
        TaskVerification storage task = taskVerifications[taskId];
        return (
            task.startTime,
            task.submissionCount,
            task.consensusReached,
            task.finalized,
            task.finalScore,
            task.verifiers
        );
    }

    /**
     * @dev Update oracle registry address
     * @param _oracleRegistry New oracle registry address
     */
    function setOracleRegistry(address _oracleRegistry) external onlyOwner {
        require(_oracleRegistry != address(0), "Invalid oracle registry");
        oracleRegistry = _oracleRegistry;
    }

    /**
     * @dev Update commit registry address
     * @param _commitRegistry New commit registry address
     */
    function setCommitRegistry(address _commitRegistry) external onlyOwner {
        require(_commitRegistry != address(0), "Invalid commit registry");
        commitRegistry = _commitRegistry;
    }

    /**
     * @dev Set escrow manager address
     * @param _escrowManager New escrow manager address
     */
    function setEscrowManager(address _escrowManager) external onlyOwner {
        require(_escrowManager != address(0), "Invalid escrow manager");
        escrowManager = _escrowManager;
    }

    /**
     * @dev Emergency finalize task (only owner)
     * @param taskId Task ID to finalize
     * @param finalScore Final score to use
     */
    function emergencyFinalize(uint256 taskId, uint8 finalScore) external onlyOwner {
        require(finalScore >= MIN_SCORE && finalScore <= MAX_SCORE, "Invalid score");
        
        TaskVerification storage task = taskVerifications[taskId];
        require(!task.finalized, "Task already finalized");
        
        task.finalized = true;
        task.finalScore = finalScore;
        task.consensusReached = true;
        
        // Trigger settlement
        if (commitRegistry != address(0)) {
            ICommitRegistry(commitRegistry).finalizeValidation(
                taskId,
                finalScore,
                address(this),
                ""
            );
        }
        
        emit TaskFinalized(taskId, finalScore, task.verifiers, block.timestamp);
    }

    // Helper functions

    /**
     * @dev Calculate variance percentage between two scores
     * @param score1 First score
     * @param score2 Second score
     * @return Variance percentage
     */
    function _calculateVariance(uint8 score1, uint8 score2) internal pure returns (uint256) {
        uint256 diff = score1 > score2 ? score1 - score2 : score2 - score1;
        return (diff * 100) / score2;
    }

    /**
     * @dev Sort scores array (bubble sort for small arrays)
     * @param scores Array to sort
     * @param length Number of valid elements
     */
    function _sortScores(uint8[] memory scores, uint256 length) internal pure {
        for (uint256 i = 0; i < length - 1; i++) {
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (scores[j] > scores[j + 1]) {
                    uint8 temp = scores[j];
                    scores[j] = scores[j + 1];
                    scores[j + 1] = temp;
                }
            }
        }
    }

    /**
     * @dev Get median score from sorted array
     * @param scores Sorted scores array
     * @param length Number of valid elements
     * @return Median score
     */
    function _getMedianScore(uint8[] memory scores, uint256 length) internal pure returns (uint8) {
        if (length % 2 == 0) {
            return (scores[length / 2 - 1] + scores[length / 2]) / 2;
        } else {
            return scores[length / 2];
        }
    }

    /**
     * @dev Check if score is within variance tolerance
     * @param score Score to check
     * @param medianScore Median score
     * @return True if within tolerance
     */
    function _isWithinTolerance(uint8 score, uint8 medianScore) internal pure returns (bool) {
        uint256 variance = _calculateVariance(score, medianScore);
        return variance <= SCORE_VARIANCE_TOLERANCE;
    }
}
