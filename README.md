# Skal - Decentralized AI Signal Trading Platform

A decentralized platform for trading AI-generated signals using commit-reveal schemes and automated market makers.

## Overview

Skal enables users to trade AI-generated signals through a transparent, decentralized marketplace. The platform uses:
- **Commit-Reveal Schemes** for secure signal submission
- **Automated Market Makers (AMM)** for price discovery
- **Reputation Systems** for signal quality assessment
- **Escrow Management** for secure fund handling

## Smart Contracts

### Flow EVM Testnet (Chain ID: 545)

**Network:** Flow EVM Testnet  
**RPC URL:** https://testnet.evm.nodes.onflow.org  
**Explorer:** https://testnet.flowscan.io/

| Contract | Address |
|----------|---------|
| **CommitRegistry** | `0xA68b3808DCf0Fd8630640018fCB96a28f497F504` |
| **EscrowManager** | `0x310BE1F533FFE873743A00aCBB69c22C980c2ECc` |
| **AMMEngine** | `0xdC13a4eD2717a7b1E0dE2E55beF927c291A4fA0e` |
| **ReputationManager** | `0xAF16AdAE0A157C92e2B173F2579e1f063A7aABE7` |
| **AgentRegistry** | `0x02A56612A4D8D7ae38BD577Be3222D26a4846032` |

### Test Markets

| Market ID | Description | Status |
|-----------|-------------|--------|
| 1 | ETH Price Prediction | Active |
| 2 | DeFi Signals | Active |
| 3 | NLP Embeddings | Active |

### Somnia Testnet (Chain ID: 50312)

**Network:** Somnia Testnet  
**RPC URL:** https://dream-rpc.somnia.network/  
**Explorer:** https://shannon-explorer.somnia.network/

| Contract | Address |
|----------|---------|
| **CommitRegistry** | `0x8D7cd1c2bEcA4eb4cE7aa0fA37eCB61ea125171f` |
| **EscrowManager** | `0x5952b85E23388130A0D2C34B1151A4d60414d998` |
| **AMMEngine** | `0x463f717e81182B3949b7d0382d30471984921f2f` |
| **ReputationManager** | `0xd1077A0D78b8F6969f16c7409CdaB566B6d62486` |
| **AgentRegistry** | `0x4cc020E6eC340401cdb4f89fC09E5ad3920E5E46` |

## Architecture

### Core Components

1. **CommitRegistry**: Manages signal commitments and reveals
2. **EscrowManager**: Handles fund escrow and settlements
3. **AMMEngine**: Provides automated market making functionality
4. **ReputationManager**: Tracks agent reputation scores
5. **AgentRegistry**: Manages registered AI agents

### Frontend

- **Next.js 14** with TypeScript
- **Wagmi** for Ethereum interactions
- **Tailwind CSS** for styling
- **Three.js** for 3D visualizations

### Backend

- **Node.js** agents for signal processing
- **TypeScript** for type safety
- **Ethers.js** for blockchain interactions

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd skal

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add your private key and other configuration

# Start development server
pnpm dev
```

### Deployment

```bash
# Deploy to Flow EVM Testnet
cd somnia
export PRIVATE_KEY=your_private_key
npm run deploy:flow-testnet

# Deploy to Somnia Testnet
npm run deploy:testnet
```

## Development

### Smart Contracts

Located in `somnia/contracts/`:
- `CommitRegistry.sol` - Signal commitment management
- `EscrowManager.sol` - Fund escrow system
- `AMMEngine.sol` - Automated market maker
- `ReputationManager.sol` - Reputation tracking
- `AgentRegistry.sol` - Agent management

### Frontend

Located in `app/` and `components/`:
- React components for UI
- Wagmi hooks for blockchain interactions
- 3D visualizations with Three.js

### Backend Agents

Located in `backend/agents/`:
- AI signal processing agents
- Market making strategies
- Verification systems

## License

MIT License - see LICENSE file for details
