# Skal - Autonomous AI Signal Trading Platform

A next-generation decentralized platform that enables truly autonomous AI agents to trade, generate, and verify AI signals through intelligent market making and commit-reveal schemes.

## Overview

Skal represents the future of decentralized AI trading, where autonomous agents make real-time decisions based on market intelligence, risk assessment, and AI-powered analysis. The platform combines:

- **🤖 Autonomous AI Agents** - Self-operating agents that make intelligent trading decisions
- **🧠 AI-Powered Decision Making** - Gemini AI integration for complex market analysis
- **⚡ Real-Time Market Intelligence** - On-chain data analysis and price prediction
- **🛡️ Advanced Risk Management** - Dynamic risk assessment and portfolio optimization
- **🔄 Commit-Reveal Schemes** - Secure signal submission and verification
- **📊 Automated Market Makers** - Intelligent liquidity provision and arbitrage detection
- **⭐ Reputation Systems** - Quality-based agent scoring and trust mechanisms

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

### 🤖 Autonomous AI Agent System

The platform features a sophisticated multi-agent system where each agent operates independently with AI-driven decision making:

#### **Buyer Agent** 🛒
- **AI-Powered Task Evaluation**: Uses Gemini AI to analyze signal quality, provider reputation, and market conditions
- **Intelligent Risk Assessment**: Dynamic risk scoring and optimal stake size calculation
- **Real-Time Decision Making**: Fast local ML models for screening + deep AI analysis for complex decisions
- **Performance Learning**: Continuous improvement based on trading outcomes

#### **Liquidity Provider Agent** 💧
- **AI-Driven Market Making**: Intelligent liquidity provision based on market analysis
- **Dynamic Pricing**: Real-time price optimization using market intelligence
- **Arbitrage Detection**: Automated identification and execution of arbitrage opportunities
- **Portfolio Rebalancing**: AI-optimized allocation across multiple markets

#### **Provider Agent** 📊
- **AI-Generated Signals**: Gemini-powered creation of high-quality trading signals
- **Market Demand Analysis**: Intelligent assessment of market needs and competition
- **Optimal Stake Calculation**: Risk-based determination of signal stakes
- **Quality Optimization**: Continuous improvement of signal generation

#### **Verifier Agent** 🔍
- **AI-Powered Verification**: Advanced quality assessment using multiple AI models
- **Data Integrity Analysis**: Comprehensive validation of signal authenticity
- **Market Alignment Scoring**: Cross-reference signals with market expectations
- **Dispute Prevention**: Proactive quality control to minimize disputes

### 🏗️ Core Infrastructure

#### **AI Decision Engine**
- **Central AI Brain**: Gemini API integration for complex decision-making
- **Local ML Models**: Fast decision trees, regression models, and anomaly detection
- **Decision Caching**: Optimized API usage and fallback mechanisms
- **Performance Monitoring**: Real-time tracking and optimization

#### **Market Intelligence System**
- **On-Chain Analysis**: Real-time blockchain data processing
- **Price Prediction**: Time-series models for market forecasting
- **Sentiment Analysis**: Provider and market sentiment scoring
- **Arbitrage Detection**: Cross-market opportunity identification

#### **Risk Management System**
- **Dynamic Risk Assessment**: Real-time risk scoring for all positions
- **Portfolio Optimization**: Kelly Criterion and modern portfolio theory
- **Stop-Loss Management**: AI-determined exit strategies
- **Hedging Strategies**: Automated risk mitigation

### 🎨 Frontend

- **Next.js 14** with TypeScript and App Router
- **Wagmi v2** for Ethereum interactions
- **Tailwind CSS** with glassmorphic design
- **Three.js** for immersive 3D visualizations
- **Real-Time Updates** via contract event listeners
- **Responsive Design** for all device types

### ⚙️ Backend

- **Node.js** with TypeScript for type safety
- **Ethers.js v6** for blockchain interactions
- **AI Integration** with Google Gemini API
- **Event-Driven Architecture** for real-time updates
- **Performance Monitoring** and analytics
- **Modular Agent System** for easy extension

### 🔗 Smart Contracts

1. **CommitRegistry**: Manages signal commitments and reveals with AI integration
2. **EscrowManager**: Handles fund escrow and settlements with risk management
3. **AMMEngine**: Provides intelligent market making with AI-driven pricing
4. **ReputationManager**: Tracks agent reputation with dynamic scoring
5. **AgentRegistry**: Manages registered AI agents with performance metrics

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** for runtime environment
- **pnpm** for package management
- **Git** for version control
- **Google Gemini API Key** for AI functionality
- **Ethereum Wallet** with testnet funds

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd skal

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Configure AI and blockchain settings
# Add your Gemini API key, private key, and RPC URLs
```

### Environment Configuration

Create `.env.local` with the following variables:

```env
# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Blockchain Configuration
PRIVATE_KEY=your_private_key_here
RPC_URL=https://dream-rpc.somnia.network/

# Contract Addresses (Somnia Testnet)
COMMIT_REGISTRY_ADDRESS=0x8D7cd1c2bEcA4eb4cE7aa0fA37eCB61ea125171f
ESCROW_MANAGER_ADDRESS=0x5952b85E23388130A0D2C34B1151A4d60414d998
AMM_ENGINE_ADDRESS=0x463f717e81182B3949b7d0382d30471984921f2f
REPUTATION_MANAGER_ADDRESS=0xd1077A0D78b8F6969f16c7409CdaB566B6d62486
AGENT_REGISTRY_ADDRESS=0x4cc020E6eC340401cdb4f89fC09E5ad3920E5E46

# AI Agent Settings
AI_DECISION_CONFIDENCE_THRESHOLD=0.7
AI_MAX_STAKE_PERCENTAGE=0.1
AI_RISK_TOLERANCE=0.6
ENABLE_PERFORMANCE_TRACKING=true
```

### Running the Platform

```bash
# Start the frontend development server
pnpm dev

# Start autonomous AI agents (in separate terminal)
cd backend/agents
npm install
npm start

# Deploy smart contracts (if needed)
cd somnia
npm install
npm run deploy:testnet
```

### 🧠 AI Agent Configuration

The autonomous agents can be configured for different strategies:

```bash
# Start individual agents
npm run start:buyer    # AI-powered buying agent
npm run start:lp       # Intelligent liquidity provider
npm run start:provider # AI signal generator
npm run start:verifier # AI verification agent

# Start all agents with orchestration
npm run start:all
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
