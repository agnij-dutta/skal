# Oracle Network Deployment Guide

## Overview

This guide covers deploying and configuring the decentralized oracle network for Shadow Protocol. The oracle network provides multi-signature consensus verification for AI data marketplace tasks.

## Architecture

- **OracleRegistry**: Manages oracle node registration, staking, and reputation
- **VerificationAggregator**: Collects verification submissions and determines consensus
- **Oracle Nodes**: Independent AI-powered verifiers running backend services

## Prerequisites

1. Somnia testnet account with sufficient STT (for deployment and oracle stakes)
2. Node.js v18+ and npm/pnpm
3. Hardhat for contract deployment
4. `.env.local` configured with necessary keys

## Step 1: Deploy Oracle Contracts

### 1.1 Navigate to contracts directory

```bash
cd somnia
```

### 1.2 Deploy oracle infrastructure

```bash
npx hardhat run scripts/deploy-oracle.js --network somnia
```

This will:
- Deploy `OracleRegistry` contract
- Deploy `VerificationAggregator` contract  
- Link them to existing `CommitRegistry`
- Output contract addresses

### 1.3 Update environment variables

Add the deployed addresses to `.env.local`:

```env
# Oracle Network
ORACLE_REGISTRY=0x... # From deployment output
VERIFICATION_AGGREGATOR=0x... # From deployment output

# Oracle Configuration
ORACLE_MODE=multi_sig
MIN_ORACLES=3
CONSENSUS_THRESHOLD=2
ORACLE_STAKE_AMOUNT=0.1

# Oracle Node Keys (3 different wallets)
ORACLE_1_PK=0x...
ORACLE_2_PK=0x...
ORACLE_3_PK=0x...
```

### 1.4 Update frontend configuration

Edit `lib/somnia-config.ts` to include the oracle addresses:

```typescript
export const CONTRACT_ADDRESSES = {
  // ... existing contracts
  ORACLE_REGISTRY: '0x...',
  VERIFICATION_AGGREGATOR: '0x...',
}
```

Or use environment variables:

```env
# .env.local
NEXT_PUBLIC_ORACLE_REGISTRY=0x...
NEXT_PUBLIC_VERIFICATION_AGGREGATOR=0x...
```

## Step 2: Register Oracle Nodes

### 2.1 Navigate to agents directory

```bash
cd backend/agents
```

### 2.2 Install dependencies (if not already done)

```bash
npm install
```

### 2.3 Register all oracles

```bash
npm run register:oracles
```

This will:
- Register 3 oracle nodes with configured stakes
- Display registration confirmation for each oracle
- Show oracle details (stake, reputation, address)

### 2.4 Verify registrations

Check the terminal output for:
```
✅ Oracle 1 registered successfully!
✅ Oracle 2 registered successfully!
✅ Oracle 3 registered successfully!
📊 Total Active Oracles: 3
```

## Step 3: Start Oracle Nodes

### 3.1 Start all oracle nodes simultaneously

```bash
npm run start:multi-oracle
```

This will start 3 concurrent oracle node processes, each listening for tasks to verify.

### 3.2 Verify oracle nodes are running

Look for output like:
```
✅ Loaded environment from: ...
Oracle Node 1 started with address: 0x...
Oracle 1 is registered and active
Oracle Node 1 is active and listening for tasks
```

### 3.3 Alternative: Start individual oracles

For debugging or testing, start individual oracles:

```bash
# Terminal 1
npm run start:oracle:1

# Terminal 2  
npm run start:oracle:2

# Terminal 3
npm run start:oracle:3
```

## Step 4: Test Oracle Network

### 4.1 Submit a test task

1. Open the frontend at `http://localhost:3000/commit`
2. Connect your wallet
3. Upload data and commit a task
4. Lock funds as a buyer (or have an autonomous buyer agent do it)
5. Reveal the data as the provider

### 4.2 Monitor oracle verification

Watch the terminal output for oracle nodes:

```
🧠 AI-powered verification for task 1 with CID Qm...
AI Verification (1): Task 1 scored 85
Submitting verification for task 1: score 85 (Oracle: 1)
✅ Verification confirmed for task 1
```

### 4.3 Check consensus on frontend

The commit page will show:
- Oracle submission progress (e.g., "2 of 3 oracles submitted")
- Consensus status
- Final verification score after consensus

## Configuration Options

### Minimum Oracle Requirements

Edit `OracleRegistry.sol` to change:

```solidity
uint256 public constant MIN_ORACLE_STAKE = 0.1 ether; // Minimum stake per oracle
uint256 public constant MIN_ORACLES_FOR_CONSENSUS = 3; // Minimum oracles needed
```

### Consensus Settings

Edit `VerificationAggregator.sol` to change:

```solidity
uint256 public constant CONSENSUS_THRESHOLD = 2; // 2 out of 3 oracles must agree
uint256 public constant SUBMISSION_WINDOW = 5 minutes; // Time window for submissions
uint256 public constant SCORE_VARIANCE_TOLERANCE = 15; // 15% variance allowed
```

### Oracle Node Configuration

Environment variables for oracle behavior:

```env
# Oracle AI Settings
AI_VERIFICATION_TIMEOUT=30000 # ms
AI_QUALITY_THRESHOLD=0.7

# Oracle Network Settings
ORACLE_SUBMISSION_RETRY=3
ORACLE_GAS_LIMIT=500000
```

## Troubleshooting

### Oracle not registered

**Error**: `⚠️ Oracle X is NOT registered`

**Solution**: 
```bash
npm run register:oracles
```

Ensure you have sufficient STT for the stake (default 0.1 STT per oracle).

### .env not found

**Error**: `node: .env: not found`

**Solution**: This has been fixed in the updated `index.ts`. The system now tries multiple locations for `.env.local`. Ensure `.env.local` exists in the project root.

### Verification stuck

**Error**: No oracles submitting verifications

**Causes & Solutions**:
1. **Oracle nodes not running**: Start with `npm run start:multi-oracle`
2. **Oracle keys not set**: Check `ORACLE_1_PK`, `ORACLE_2_PK`, `ORACLE_3_PK` in `.env.local`
3. **Insufficient gas**: Increase `ORACLE_GAS_LIMIT` or check oracle wallet balances

### Consensus not reached

**Issue**: Oracles submitting but no consensus

**Causes**:
- Scores too divergent (variance > 15%)
- Not enough submissions (< 2 oracles)
- Submission window expired

**Solutions**:
1. Check oracle logs for score discrepancies
2. Adjust `SCORE_VARIANCE_TOLERANCE` in contract
3. Ensure all 3 oracles are running

## Monitoring & Maintenance

### Check Oracle Status

Query oracle details on-chain:

```javascript
const oracle = await oracleRegistry.getOracle(oracleAddress)
console.log('Reputation:', oracle.reputation)
console.log('Success Rate:', oracle.successfulValidations / oracle.totalValidations)
```

### Monitor Slashing Events

Watch for malicious behavior:

```javascript
oracleRegistry.on('OracleSlashed', (oracle, amount, reason) => {
  console.log(`Oracle ${oracle} slashed ${amount} for: ${reason}`)
})
```

### Oracle Reputation Management

Oracles automatically gain/lose reputation based on consensus alignment:
- **+5 reputation** for accurate submissions (within variance tolerance)
- **-1 reputation** for inaccurate submissions
- **-20 reputation + 10% stake slash** for malicious submissions (3x variance)

### Upgrade Oracle Stake

If an oracle is slashed below minimum:

```javascript
await oracleRegistry.increaseStake({ value: ethers.parseEther('0.1') })
```

## Production Recommendations

1. **Use separate servers** for each oracle node (geographic distribution)
2. **Implement monitoring** (Datadog, Prometheus) for oracle uptime
3. **Set up alerts** for slashing events or low stake warnings
4. **Regular backups** of oracle private keys (securely!)
5. **Load balancing** for high-throughput scenarios
6. **Gradual rollout**: Start with testnet, then mainnet with higher stakes

## Chainlink Integration (Optional)

To enable Chainlink as an alternative oracle source:

1. Deploy `ChainlinkOracleAdapter.sol`
2. Set `USE_CHAINLINK=true` in `.env.local`
3. Configure Chainlink-specific settings:

```env
USE_CHAINLINK=true
CHAINLINK_ORACLE=0x...
CHAINLINK_JOB_ID=...
CHAINLINK_FEE=0.1
```

The system will fall back to custom oracles if Chainlink is unavailable.

## Security Considerations

1. **Private Key Management**: Never commit oracle private keys. Use hardware wallets for mainnet.
2. **Rate Limiting**: Implement rate limits on oracle submissions to prevent spam.
3. **Gas Price Management**: Monitor gas prices and implement dynamic gas pricing.
4. **Redundancy**: Always run more oracles than the minimum required.
5. **Upgrade Path**: Keep oracle node software up to date.

## Support

For issues or questions:
- Check oracle logs in `backend/agents/logs/` (if logging enabled)
- Review blockchain events on Somnia explorer
- Consult the main README.md for general setup

---

**Last Updated**: October 2025  
**Compatible with**: Shadow Protocol v0.1.0






