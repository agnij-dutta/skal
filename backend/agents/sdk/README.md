# Skal Agents SDK

A plug-and-play SDK for building intelligence signal trading agents on Flow blockchain with Flow Actions and Scheduled Transactions support.

## Features

- **Multi-Chain Support**: Works with Flow Cadence and EVM-compatible chains
- **Flow Actions Integration**: Leverage Flow Actions for composable DeFi operations
- **Scheduled Transactions**: Autonomous agent operations without off-chain keepers
- **AI-Powered Decisions**: Built-in AI decision engine for signal evaluation
- **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @skal/agents-sdk
```

## Quick Start

### Creating a Signal Provider Agent

```typescript
import { FlowAdapter } from '@skal/agents-sdk'
import { AgentConfig } from '@skal/agents-sdk'

const config: AgentConfig = {
  chainId: 'flow-testnet',
  name: 'Flow Testnet',
  rpcUrl: 'https://testnet.evm.nodes.onflow.org',
  nativeCurrency: { symbol: 'FLOW', decimals: 18 },
  contracts: {
    commitRegistry: '0x...',
    escrowManager: '0x...',
    ammEngine: '0x...',
    reputationManager: '0x...',
    agentRegistry: '0x...',
  },
}

const adapter = new FlowAdapter(config)
await adapter.initialize()

// Create and commit a signal
const signalId = await adapter.commitSignal(commitHash, marketId, stake)
```

### Buying Signals

```typescript
import { FlowAdapter, AIDecisionEngine } from '@skal/agents-sdk'

const adapter = new FlowAdapter(config)
await adapter.initialize()

// Use Flow Actions to buy signal
const result = await adapter.buySignal(signalId, amountIn)
```

### Adding Liquidity

```typescript
// Add liquidity using Flow Actions Sink
await adapter.addLiquidity(marketId, amountA, amountB)
```

## Flow Actions Integration

### Source → Swapper → Sink Workflow

```typescript
import { FlowAdapter } from '@shadow-protocol/agents-sdk'

// Compose workflows using Flow Actions
const result = await adapter.executeWorkflow({
  source: 'vault-source',
  swapper: 'signal-market-amm',
  sink: 'escrow-sink',
  amount: '10.0',
})
```

### Scheduled Transactions

```typescript
// Schedule auto-reveal
await adapter.scheduleTransaction('AutoRevealHandler', 86400, { signalId })
```

## Architecture

```
SDK/
├── core/           # Base agent classes
├── chains/         # Chain adapters (Flow, EVM)
├── agents/         # Agent implementations
├── ai/             # AI decision engine
└── utils/          # Utilities (crypto, storage)
```

## Documentation

See the full documentation at [docs.SDK_GUIDE.md](../docs/SDK_GUIDE.md)

## Examples

Check out the [examples/](../examples/) directory for complete agent implementations.

## License

MIT
