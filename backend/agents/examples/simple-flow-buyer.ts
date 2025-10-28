import { FlowAdapter, AIDecisionEngine, MarketIntelligence } from '../sdk'
import { ChainConfig } from '../sdk/chains/ChainConfig'

/**
 * Simple Flow Buyer Agent
 * Demonstrates buying signals using Flow Actions
 */

const config: ChainConfig = {
  chainId: 'flow-testnet',
  name: 'Flow Testnet',
  rpcUrl: 'https://testnet.evm.nodes.onflow.org',
  nativeCurrency: { symbol: 'FLOW', decimals: 18 },
  contracts: {
    commitRegistry: process.env.FLOW_COMMIT_REGISTRY || '',
    escrowManager: process.env.FLOW_ESCROW_MANAGER || '',
    ammEngine: process.env.FLOW_AMM_ENGINE || '',
    reputationManager: process.env.FLOW_REPUTATION_MANAGER || '',
    agentRegistry: process.env.FLOW_AGENT_REGISTRY || '',
  },
}

const adapter = new FlowAdapter(config)
const aiEngine = new AIDecisionEngine()
const marketIntel = new MarketIntelligence()

async function startBuyer() {
  console.log('🛒 Starting Flow Buyer Agent...')
  
  await adapter.initialize()
  
  // Listen for new signals
  adapter.on('SignalCommitted', async (data: any) => {
    console.log('🔍 New signal detected:', data)
    
    try {
      // Evaluate signal
      const decision = await aiEngine.shouldBuy({
        signalId: data.signalId,
        marketId: data.marketId,
        provider: data.provider,
        stake: data.stake,
      })
      
      if (decision.shouldBuy && decision.confidence > 0.7) {
        // Buy signal using Flow Actions
        const result = await adapter.buySignal(
          data.signalId,
          decision.recommendedAmount.toString()
        )
        
        console.log('✅ Signal purchased:', result)
      }
    } catch (error) {
      console.error('❌ Error buying signal:', error)
    }
  })
  
  console.log('👂 Listening for signals...')
}

startBuyer().catch(console.error)
