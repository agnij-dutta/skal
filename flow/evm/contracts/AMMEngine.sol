// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title AMMEngine
 * @dev Automated Market Maker for intelligence trading
 * @notice Implements constant-product (x*y=k) bonding curve for per-market liquidity pools
 */
contract AMMEngine is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // LP Token for each market
    mapping(uint256 => address) public marketLPTokens;
    
    // Market structure
    struct Market {
        uint256 marketId;
        address tokenA; // Base token (ETH)
        address tokenB; // Intelligence token
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalSupply;
        bool active;
        uint256 createdAt;
    }

    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed tokenA,
        address indexed tokenB,
        uint256 timestamp
    );
    
    event LiquidityAdded(
        uint256 indexed marketId,
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpTokens,
        uint256 timestamp
    );
    
    event LiquidityRemoved(
        uint256 indexed marketId,
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpTokens,
        uint256 timestamp
    );
    
    event SignalBought(
        uint256 indexed marketId,
        address indexed buyer,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    
    event SignalSold(
        uint256 indexed marketId,
        address indexed seller,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    // State variables
    mapping(uint256 => Market) public markets;
    mapping(address => mapping(uint256 => uint256)) public userLPTokens;
    
    // External contract addresses
    address public commitRegistry;
    address public escrowManager;
    
    // Configuration
    uint256 public constant FEE_PERCENT = 30; // 0.3%
    uint256 public constant MIN_LIQUIDITY = 1000; // Minimum liquidity units
    uint256 public constant PRECISION = 10000; // For fee calculations
    
    // Fee collection
    address public feeCollector;
    mapping(uint256 => uint256) public marketFees;

    // Modifiers
    modifier validMarket(uint256 marketId) {
        require(markets[marketId].active, "Market not active");
        _;
    }

    modifier validAmounts(uint256 amountA, uint256 amountB) {
        require(amountA > 0 && amountB > 0, "Invalid amounts");
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
        address _escrowManager
    ) external onlyOwner {
        commitRegistry = _commitRegistry;
        escrowManager = _escrowManager;
    }

    /**
     * @dev Create a new market
     * @param marketId Market ID
     * @param tokenA Base token address (ETH = address(0))
     * @param tokenB Intelligence token address
     */
    function createMarket(
        uint256 marketId,
        address tokenA,
        address tokenB
    ) external onlyOwner {
        require(!markets[marketId].active, "Market already exists");
        // Allow markets where both tokens are native STT (address(0))

        markets[marketId] = Market({
            marketId: marketId,
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: 0,
            reserveB: 0,
            totalSupply: 0,
            active: true,
            createdAt: block.timestamp
        });

        // Deploy LP token for this market
        string memory lpTokenName = string(abi.encodePacked("SLL-LP-", _toString(marketId)));
        string memory lpTokenSymbol = string(abi.encodePacked("SLL-LP", _toString(marketId)));
        
        LPToken lpToken = new LPToken(lpTokenName, lpTokenSymbol);
        marketLPTokens[marketId] = address(lpToken);

        emit MarketCreated(marketId, tokenA, tokenB, block.timestamp);
    }

    /**
     * @dev Add liquidity to a market
     * @param marketId Market ID
     * @param amountA Amount of token A
     * @param amountB Amount of token B
     */
    function addLiquidity(
        uint256 marketId,
        uint256 amountA,
        uint256 amountB
    ) external payable validMarket(marketId) validAmounts(amountA, amountB) nonReentrant {
        Market storage market = markets[marketId];
        
        if (market.tokenA == address(0)) {
            // ETH market for tokenA
            if (market.tokenB == address(0)) {
                // Both sides are native STT: require total msg.value to cover both amounts
                require(msg.value == amountA + amountB, "ETH amount mismatch");
            } else {
                // Only tokenA is native
                require(msg.value == amountA, "ETH amount mismatch");
            }
        } else {
            // ERC20 market
            IERC20(market.tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        }
        
        if (market.tokenB != address(0)) {
            IERC20(market.tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        }

        uint256 lpTokens;
        
        if (market.totalSupply == 0) {
            // First liquidity provision
            lpTokens = sqrt(amountA * amountB);
            require(lpTokens >= MIN_LIQUIDITY, "Insufficient liquidity");
        } else {
            // Calculate LP tokens based on existing reserves
            uint256 lpTokensA = (amountA * market.totalSupply) / market.reserveA;
            uint256 lpTokensB = (amountB * market.totalSupply) / market.reserveB;
            lpTokens = (lpTokensA < lpTokensB) ? lpTokensA : lpTokensB;
        }

        // Update reserves
        market.reserveA += amountA;
        market.reserveB += amountB;
        market.totalSupply += lpTokens;

        // Mint LP tokens
        LPToken(marketLPTokens[marketId]).mint(msg.sender, lpTokens);
        userLPTokens[msg.sender][marketId] += lpTokens;

        emit LiquidityAdded(marketId, msg.sender, amountA, amountB, lpTokens, block.timestamp);
    }

    /**
     * @dev Remove liquidity from a market
     * @param marketId Market ID
     * @param lpTokens Amount of LP tokens to burn
     */
    function removeLiquidity(
        uint256 marketId,
        uint256 lpTokens
    ) external validMarket(marketId) nonReentrant {
        require(lpTokens > 0, "Invalid LP token amount");
        require(userLPTokens[msg.sender][marketId] >= lpTokens, "Insufficient LP tokens");

        Market storage market = markets[marketId];
        
        // Calculate amounts to return
        uint256 amountA = (lpTokens * market.reserveA) / market.totalSupply;
        uint256 amountB = (lpTokens * market.reserveB) / market.totalSupply;
        
        require(amountA > 0 && amountB > 0, "Insufficient liquidity");

        // Update reserves
        market.reserveA -= amountA;
        market.reserveB -= amountB;
        market.totalSupply -= lpTokens;

        // Burn LP tokens
        LPToken(marketLPTokens[marketId]).burn(msg.sender, lpTokens);
        userLPTokens[msg.sender][marketId] -= lpTokens;

        // Transfer tokens back
        if (market.tokenA == address(0)) {
            payable(msg.sender).transfer(amountA);
        } else {
            IERC20(market.tokenA).safeTransfer(msg.sender, amountA);
        }

        if (market.tokenB == address(0)) {
            payable(msg.sender).transfer(amountB);
        } else {
            IERC20(market.tokenB).safeTransfer(msg.sender, amountB);
        }

        emit LiquidityRemoved(marketId, msg.sender, amountA, amountB, lpTokens, block.timestamp);
    }

    /**
     * @dev Buy intelligence signal
     * @param marketId Market ID
     * @param amountIn Amount of token A to spend
     * @param minAmountOut Minimum amount of token B to receive
     */
    function buySignal(
        uint256 marketId,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable validMarket(marketId) nonReentrant {
        Market storage market = markets[marketId];
        require(market.reserveA > 0 && market.reserveB > 0, "No liquidity");

        if (market.tokenA == address(0)) {
            require(msg.value == amountIn, "ETH amount mismatch");
        } else {
            IERC20(market.tokenA).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        uint256 amountOut = getAmountOut(amountIn, market.reserveA, market.reserveB);
        require(amountOut >= minAmountOut, "Slippage too high");

        // Update reserves
        market.reserveA += amountIn;
        market.reserveB -= amountOut;

        // Transfer output token
        if (market.tokenB == address(0)) {
            payable(msg.sender).transfer(amountOut);
        } else {
            IERC20(market.tokenB).safeTransfer(msg.sender, amountOut);
        }

        // Collect fees
        uint256 fee = (amountIn * FEE_PERCENT) / PRECISION;
        marketFees[marketId] += fee;

        emit SignalBought(marketId, msg.sender, amountIn, amountOut, block.timestamp);
    }

    /**
     * @dev Sell intelligence signal
     * @param marketId Market ID
     * @param amountIn Amount of token B to sell
     * @param minAmountOut Minimum amount of token A to receive
     */
    function sellSignal(
        uint256 marketId,
        uint256 amountIn,
        uint256 minAmountOut
    ) external validMarket(marketId) nonReentrant {
        Market storage market = markets[marketId];
        require(market.reserveA > 0 && market.reserveB > 0, "No liquidity");

        if (market.tokenB != address(0)) {
            IERC20(market.tokenB).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        uint256 amountOut = getAmountOut(amountIn, market.reserveB, market.reserveA);
        require(amountOut >= minAmountOut, "Slippage too high");

        // Update reserves
        market.reserveB += amountIn;
        market.reserveA -= amountOut;

        // Transfer output token
        if (market.tokenA == address(0)) {
            payable(msg.sender).transfer(amountOut);
        } else {
            IERC20(market.tokenA).safeTransfer(msg.sender, amountOut);
        }

        // Collect fees
        uint256 fee = (amountIn * FEE_PERCENT) / PRECISION;
        marketFees[marketId] += fee;

        emit SignalSold(marketId, msg.sender, amountIn, amountOut, block.timestamp);
    }

    /**
     * @dev Get amount out for a given amount in (constant product formula)
     * @param amountIn Input amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return Amount out
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "Invalid amount in");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");
        
        uint256 amountInWithFee = amountIn * (PRECISION - FEE_PERCENT);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * PRECISION) + amountInWithFee;
        
        return numerator / denominator;
    }

    /**
     * @dev Get market info
     * @param marketId Market ID
     * @return Market struct
     */
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /**
     * @dev Get user's LP token balance for a market
     * @param user User address
     * @param marketId Market ID
     * @return LP token balance
     */
    function getUserLPTokens(address user, uint256 marketId) external view returns (uint256) {
        return userLPTokens[user][marketId];
    }

    /**
     * @dev Get market fees collected
     * @param marketId Market ID
     * @return Total fees collected
     */
    function getMarketFees(uint256 marketId) external view returns (uint256) {
        return marketFees[marketId];
    }

    /**
     * @dev Withdraw market fees (only owner)
     * @param marketId Market ID
     */
    function withdrawMarketFees(uint256 marketId) external onlyOwner {
        uint256 fees = marketFees[marketId];
        marketFees[marketId] = 0;
        
        if (fees > 0) {
            if (markets[marketId].tokenA == address(0)) {
                payable(feeCollector).transfer(fees);
            } else {
                IERC20(markets[marketId].tokenA).safeTransfer(feeCollector, fees);
            }
        }
    }

    /**
     * @dev Square root function
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @dev Convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

/**
 * @title LPToken
 * @dev LP Token for each market
 */
contract LPToken is ERC20 {
    address public ammEngine;
    
    modifier onlyAMMEngine() {
        require(msg.sender == ammEngine, "Only AMMEngine");
        _;
    }
    
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        ammEngine = msg.sender;
    }
    
    function mint(address to, uint256 amount) external onlyAMMEngine {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external onlyAMMEngine {
        _burn(from, amount);
    }
}
