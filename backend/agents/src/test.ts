#!/usr/bin/env node

import { AgentOrchestrator, AgentConfig } from './services/AgentOrchestrator.js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Test configuration
const config: AgentConfig = {
  rpcUrl: process.env.SOMNIA_RPC || 'https://dream-rpc.somnia.network/',
  storageUrl: process.env.STORAGE_URL || 'http://localhost:8787',
  contractAddresses: {
    commitRegistry: process.env.COMMIT_REGISTRY || '0xB94ecC5a4cA8D7D2749cE8353F03B38372235C26',
    escrowManager: process.env.ESCROW_MANAGER || '0x8F9Cce60CDa5c3b262c30321f40a180A6A9DA762',
    ammEngine: process.env.AMM_ENGINE || '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC',
    reputationManager: process.env.REPUTATION_MANAGER || '0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8',
    agentRegistry: process.env.AGENT_REGISTRY || '0x2CC077f1Da27e7e08A1832804B03b30A2990a61C'
  },
  agentKeys: {
    provider: process.env.PROVIDER_PK || '',
    buyer: process.env.BUYER_PK || '',
    verifier: process.env.VERIFIER_PK || '',
    lp: process.env.LP_PK || ''
  },
  marketConfig: {
    marketId: parseInt(process.env.MARKET_ID || '1'),
    stakeAmount: process.env.STAKE_ETH || '0.05',
    buyAmount: process.env.BUY_AMOUNT_ETH || '0.05',
    lpAmountA: process.env.LP_AMOUNT_A_ETH || '0.2',
    lpAmountB: process.env.LP_AMOUNT_B || '1000000000000000000'
  }
}

async function testAgents() {
  console.log('🧪 Testing Shadow Protocol Agents...')
  
  try {
    // Create orchestrator
    const orchestrator = new AgentOrchestrator(config)
    
    // Setup event listeners
    orchestrator.on('started', () => {
      console.log('✅ All agents started successfully!')
    })
    
    orchestrator.on('error', (error) => {
      console.error('❌ Agent error:', error)
    })
    
    // Start orchestrator
    console.log('🚀 Starting agent orchestrator...')
    await orchestrator.start()
    
    // Run for 30 seconds then stop
    console.log('⏰ Running for 30 seconds...')
    setTimeout(async () => {
      console.log('🛑 Stopping agents...')
      await orchestrator.stop()
      process.exit(0)
    }, 30000)
    
  } catch (error) {
    console.error('💥 Test failed:', error)
    process.exit(1)
  }
}

testAgents()
