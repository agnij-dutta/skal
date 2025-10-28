# Deploy to Flow EVM Testnet

## Prerequisites

1. Flow testnet FLOW tokens from faucet:
   - Go to: https://testnet-faucet.onflow.org/
   - Request testnet FLOW
   - You need at least 0.01 FLOW for deployment

2. Private Key for deployment:
   - Export your private key as environment variable
   - `export PRIVATE_KEY="your_private_key_here"`

3. Install dependencies:
   ```bash
   npm install
   ```

## Deployment Steps

### Step 1: Get Flow Testnet FLOW

1. Visit https://testnet-faucet.onflow.org/
2. Request testnet FLOW tokens
3. Wait for the transaction to confirm

### Step 2: Set Environment Variables

```bash
export PRIVATE_KEY="your_private_key_here"
```

### Step 3: Compile Contracts

```bash
npm run compile
```

### Step 4: Deploy to Flow EVM Testnet

```bash
npm run deploy:flow-evm
```

This will:
- Deploy all 5 contracts (CommitRegistry, EscrowManager, AMMEngine, ReputationManager, AgentRegistry)
- Set up cross-contract references
- Create 3 test markets (ETH Price Prediction, DeFi Signals, NLP Embeddings)
- Save deployment info to `deployment-flow.json`

### Step 5: Verify Deployment

1. Check `deployment-flow.json` for deployed addresses
2. Verify on block explorer: https://evm-testnet.flowscan.org/
3. Test contract interactions

## Contract Addresses

After deployment, the addresses will be saved to `deployment-flow.json`:

```json
{
  "network": "flow-evm-testnet",
  "chainId": 545,
  "contracts": {
    "CommitRegistry": "0x...",
    "EscrowManager": "0x...",
    "AMMEngine": "0x...",
    "ReputationManager": "0x...",
    "AgentRegistry": "0x..."
  }
}
```

## Next Steps

1. Update `lib/flow-config.ts` with deployed addresses:
   ```typescript
   export const CONTRACT_ADDRESSES_FLOW = {
     COMMIT_REGISTRY: "0x...",
     ESCROW_MANAGER: "0x...",
     AMM_ENGINE: "0x...",
     REPUTATION_MANAGER: "0x...",
     AGENT_REGISTRY: "0x...",
   }
   ```

2. Test contracts:
   - Commit a signal
   - Buy a signal
   - Add liquidity
   - Create an agent

3. Deploy agents:
   - Use the SDK to connect to Flow EVM
   - Run provider agents
   - Run buyer agents
   - Run LP agents

## Troubleshooting

### Error: Insufficient balance

**Solution**: Get more testnet FLOW from https://testnet-faucet.onflow.org/

### Error: Network not found

**Solution**: Make sure you're using the correct RPC URL in `hardhat.config.cjs`

### Error: Nonce too low

**Solution**: Wait a bit and try again, or reset your account nonce

## Useful Links

- Flow EVM Testnet Explorer: https://evm-testnet.flowscan.org/
- Flow EVM RPC: https://testnet.evm.nodes.onflow.org/
- Flow Faucet: https://testnet-faucet.onflow.org/
- Flow Documentation: https://developers.flow.com/
