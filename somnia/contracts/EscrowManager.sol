// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title EscrowManager
 * @dev Manages fund escrow and settlement for Shadow Protocol
 * @notice Handles buyer fund locking and automated release based on verification results
 */
contract EscrowManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Escrow states
    enum EscrowState {
        Locked,
        Released,
        Disputed,
        Refunded
    }

    // Escrow structure
    struct Escrow {
        uint256 taskId;
        address buyer;
        address provider;
        uint256 amount;
        uint256 timestamp;
        EscrowState state;
        uint256 disputeDeadline;
        address disputer;
    }

    // Events
    event FundsLocked(
        uint256 indexed taskId,
        address indexed buyer,
        address indexed provider,
        uint256 amount,
        uint256 timestamp
    );
    
    event FundsReleased(
        uint256 indexed taskId,
        address indexed provider,
        uint256 amount,
        uint256 timestamp
    );
    
    event FundsRefunded(
        uint256 indexed taskId,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );
    
    event DisputeInitiated(
        uint256 indexed taskId,
        address indexed disputer,
        uint256 timestamp
    );
    
    event DisputeResolved(
        uint256 indexed taskId,
        bool providerWins,
        uint256 timestamp
    );

    // State variables
    mapping(uint256 => Escrow) public escrows;
    mapping(address => uint256[]) public buyerEscrows;
    mapping(address => uint256[]) public providerEscrows;
    
    // External contract addresses
    address public commitRegistry;
    address public reputationManager;
    address public agentRegistry;
    
    // Configuration
    uint256 public constant DISPUTE_WINDOW = 24 hours;
    uint256 public constant MIN_ESCROW_AMOUNT = 0.001 ether;
    uint256 public constant PROTOCOL_FEE_PERCENT = 250; // 2.5%
    uint256 public constant VERIFIER_FEE_PERCENT = 200; // 2.0%
    
    // Fee collection
    address public feeCollector;
    uint256 public totalFeesCollected;

    // Modifiers
    modifier onlyCommitRegistry() {
        require(msg.sender == commitRegistry, "Only CommitRegistry");
        _;
    }

    modifier validEscrow(uint256 taskId) {
        require(escrows[taskId].amount > 0, "Escrow does not exist");
        _;
    }

    constructor(address _feeCollector) Ownable() {
        feeCollector = _feeCollector;
    }

    /**
     * @dev Set external contract addresses
     */
    function setExternalContracts(
        address _commitRegistry,
        address _reputationManager,
        address _agentRegistry
    ) external onlyOwner {
        commitRegistry = _commitRegistry;
        reputationManager = _reputationManager;
        agentRegistry = _agentRegistry;
    }

    /**
     * @dev Lock funds for a task (called by buyer)
     * @param taskId Task ID to lock funds for
     */
    function lockFunds(uint256 taskId) external payable nonReentrant {
        require(msg.value >= MIN_ESCROW_AMOUNT, "Insufficient escrow amount");
        require(commitRegistry != address(0), "CommitRegistry not set");
        
        // Verify task exists and is in committed state
        // This would require calling CommitRegistry to check task state
        // For now, we'll assume the task is valid
        
        Escrow storage escrow = escrows[taskId];
        require(escrow.amount == 0, "Escrow already exists");

        escrow.taskId = taskId;
        escrow.buyer = msg.sender;
        escrow.amount = msg.value;
        escrow.timestamp = block.timestamp;
        escrow.state = EscrowState.Locked;
        escrow.disputeDeadline = block.timestamp + DISPUTE_WINDOW;

        buyerEscrows[msg.sender].push(taskId);

        emit FundsLocked(taskId, msg.sender, address(0), msg.value, block.timestamp);
    }

    /**
     * @dev Release funds to provider (called by CommitRegistry after validation)
     * @param taskId Task ID
     * @param provider Provider address
     * @param validationScore Validation score (0-100)
     */
    function releaseFunds(
        uint256 taskId,
        address provider,
        uint8 validationScore
    ) external onlyCommitRegistry validEscrow(taskId) nonReentrant {
        Escrow storage escrow = escrows[taskId];
        
        require(escrow.state == EscrowState.Locked, "Escrow not locked");
        require(validationScore >= 50, "Validation score too low"); // Minimum 50% score

        escrow.provider = provider;
        escrow.state = EscrowState.Released;

        // Calculate fees and payout
        uint256 totalAmount = escrow.amount;
        uint256 protocolFee = (totalAmount * PROTOCOL_FEE_PERCENT) / 10000;
        uint256 verifierFee = (totalAmount * VERIFIER_FEE_PERCENT) / 10000;
        uint256 providerPayout = totalAmount - protocolFee - verifierFee;

        // Update provider escrows
        providerEscrows[provider].push(taskId);

        // Transfer funds
        if (protocolFee > 0) {
            totalFeesCollected += protocolFee;
            payable(feeCollector).transfer(protocolFee);
        }
        
        if (verifierFee > 0) {
            // TODO: Distribute verifier fee to verifier
            // For now, add to protocol fees
            totalFeesCollected += verifierFee;
            payable(feeCollector).transfer(verifierFee);
        }

        payable(provider).transfer(providerPayout);

        emit FundsReleased(taskId, provider, providerPayout, block.timestamp);
    }

    /**
     * @dev Refund funds to buyer (called when validation fails or task is cancelled)
     * @param taskId Task ID
     */
    function refundFunds(uint256 taskId) external onlyCommitRegistry validEscrow(taskId) nonReentrant {
        Escrow storage escrow = escrows[taskId];
        
        require(escrow.state == EscrowState.Locked, "Escrow not locked");

        escrow.state = EscrowState.Refunded;

        uint256 refundAmount = escrow.amount;
        payable(escrow.buyer).transfer(refundAmount);

        emit FundsRefunded(taskId, escrow.buyer, refundAmount, block.timestamp);
    }

    /**
     * @dev Initiate dispute for an escrow
     * @param taskId Task ID
     */
    function initiateDispute(uint256 taskId) external validEscrow(taskId) nonReentrant {
        Escrow storage escrow = escrows[taskId];
        
        require(escrow.state == EscrowState.Locked, "Escrow not locked");
        require(block.timestamp <= escrow.disputeDeadline, "Dispute window closed");
        require(msg.sender == escrow.buyer || msg.sender == escrow.provider, "Not authorized");

        escrow.state = EscrowState.Disputed;
        escrow.disputer = msg.sender;

        emit DisputeInitiated(taskId, msg.sender, block.timestamp);
    }

    /**
     * @dev Resolve dispute (called by owner or dispute resolution contract)
     * @param taskId Task ID
     * @param providerWins True if provider wins the dispute
     */
    function resolveDispute(uint256 taskId, bool providerWins) external onlyOwner validEscrow(taskId) nonReentrant {
        Escrow storage escrow = escrows[taskId];
        
        require(escrow.state == EscrowState.Disputed, "Escrow not disputed");

        if (providerWins) {
            // Release funds to provider
            escrow.state = EscrowState.Released;
            uint256 totalAmount = escrow.amount;
            uint256 protocolFee = (totalAmount * PROTOCOL_FEE_PERCENT) / 10000;
            uint256 providerPayout = totalAmount - protocolFee;
            
            if (protocolFee > 0) {
                totalFeesCollected += protocolFee;
                payable(feeCollector).transfer(protocolFee);
            }
            
            payable(escrow.provider).transfer(providerPayout);
            emit FundsReleased(taskId, escrow.provider, providerPayout, block.timestamp);
        } else {
            // Refund to buyer
            escrow.state = EscrowState.Refunded;
            uint256 refundAmount = escrow.amount;
            payable(escrow.buyer).transfer(refundAmount);
            emit FundsRefunded(taskId, escrow.buyer, refundAmount, block.timestamp);
        }

        emit DisputeResolved(taskId, providerWins, block.timestamp);
    }

    /**
     * @dev Get escrow details
     * @param taskId Task ID
     * @return Escrow struct
     */
    function getEscrow(uint256 taskId) external view validEscrow(taskId) returns (Escrow memory) {
        return escrows[taskId];
    }

    /**
     * @dev Get escrows by buyer
     * @param buyer Buyer address
     * @return Array of task IDs
     */
    function getBuyerEscrows(address buyer) external view returns (uint256[] memory) {
        return buyerEscrows[buyer];
    }

    /**
     * @dev Get escrows by provider
     * @param provider Provider address
     * @return Array of task IDs
     */
    function getProviderEscrows(address provider) external view returns (uint256[] memory) {
        return providerEscrows[provider];
    }

    /**
     * @dev Check if escrow can be disputed
     * @param taskId Task ID
     * @return True if escrow can be disputed
     */
    function canDispute(uint256 taskId) external view validEscrow(taskId) returns (bool) {
        Escrow storage escrow = escrows[taskId];
        return escrow.state == EscrowState.Locked && block.timestamp <= escrow.disputeDeadline;
    }

    /**
     * @dev Get total fees collected
     * @return Total fees in wei
     */
    function getTotalFeesCollected() external view returns (uint256) {
        return totalFeesCollected;
    }

    /**
     * @dev Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        payable(feeCollector).transfer(amount);
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
