# Shadow Protocol Smart Contracts

This directory contains the smart contracts for Shadow Protocol, a privacy-preserving AI intelligence marketplace built on Somnia blockchain.

## Overview

Shadow Protocol enables private, verifiable trading of AI outputs through a commit-reveal mechanism with automated market making and reputation management.

## Contracts

### Core Contracts

1. **CommitRegistry** - Manages the commit-reveal cycle for AI intelligence trading
2. **EscrowManager** - Handles fund locking and automated release based on verification
3. **AMMEngine** - Automated Market Maker with constant-product bonding curves
4. **ReputationManager** - Manages reputation scores and staking for providers/verifiers
5. **AgentRegistry** - Registry for AI agents with metadata and verification keys

### Key Features

- **Commit-Reveal Mechanism**: Private trading with encrypted data storage
- **Automated Market Making**: Per-market liquidity pools with bonding curves
- **Reputation System**: On-chain reputation scoring and slashing
- **Agent Integration**: Support for autonomous AI agents
- **Dispute Resolution**: Time-locked dispute windows with arbitration

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  CommitRegistry │    │  EscrowManager  │    │   AMMEngine     │
│                 │    │                 │    │                 │
│ • Commit/Reveal │    │ • Fund Locking  │    │ • Liquidity Pools│
│ • State Machine │    │ • Auto Release  │    │ • Bonding Curves│
│ • Time Windows  │    │ • Disputes      │    │ • Trading Fees  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────┐    ┌─────────────────┐
         │ReputationManager│    │  AgentRegistry  │
         │                 │    │                 │
         │ • Scoring       │    │ • Agent Metadata│
         │ • Slashing      │    │ • Verification  │
         │ • Staking       │    │ • Endpoints     │
         └─────────────────┘    └─────────────────┘
```

## Development

### Prerequisites

- Node.js 20+
- npm or yarn
- Hardhat

### Setup

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to testnet
npm run deploy:testnet

# Deploy to mainnet
npm run deploy:mainnet
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/CommitRegistry.test.cjs

# Run with coverage
npm run test:coverage
```

### Deployment

The deployment script will:
1. Deploy all contracts in the correct order
2. Set up cross-contract references
3. Create test markets
4. Save deployment info to `deployment.json`

```bash
# Deploy to Somnia testnet
npm run deploy:testnet

# Verify contracts
npm run verify:testnet
```

## Contract Interfaces

### CommitRegistry

```solidity
function commitTask(bytes32 commitHash, uint256 marketId, uint256 stake) external payable
function revealTask(uint256 taskId, string calldata cid) external
function finalizeValidation(uint256 taskId, uint8 score, address verifier, bytes calldata signature) external
```

### EscrowManager

```solidity
function lockFunds(uint256 taskId) external payable
function releaseFunds(uint256 taskId, address provider, uint8 validationScore) external
function initiateDispute(uint256 taskId) external
```

### AMMEngine

```solidity
function createMarket(uint256 marketId, address tokenA, address tokenB) external
function addLiquidity(uint256 marketId, uint256 amountA, uint256 amountB) external payable
function buySignal(uint256 marketId, uint256 amountIn, uint256 minAmountOut) external payable
```

## Security Features

- **Reentrancy Protection**: All state-changing functions use ReentrancyGuard
- **Access Control**: Role-based permissions with OpenZeppelin Ownable
- **Input Validation**: Comprehensive parameter validation
- **Time Windows**: Commit/reveal/validation deadlines prevent front-running
- **Slashing Mechanism**: Penalties for bad behavior
- **Emergency Functions**: Owner can pause/withdraw in emergencies

## Gas Optimization

- **viaIR Compiler**: Enabled for complex contracts
- **Optimizer**: 200 runs for gas efficiency
- **Packed Structs**: Efficient storage layout
- **Batch Operations**: Multiple operations in single transaction

## Network Configuration

### Somnia Testnet
- RPC: `https://rpc.testnet.somnia.network`
- Chain ID: `1703936` (0x1a1a1a)
- Explorer: `https://shannon-explorer.somnia.network`

### Somnia Mainnet
- RPC: `https://rpc.somnia.network`
- Chain ID: `1703937` (0x1a1a1b)
- Explorer: `https://explorer.somnia.network`

## Environment Variables

Create a `.env` file:

```env
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
REPORT_GAS=true
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For questions and support, please open an issue or contact the team.
