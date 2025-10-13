#!/usr/bin/env node

import { AgentOrchestrator, AgentConfig } from './services/AgentOrchestrator.js'
import dotenv from 'dotenv'

dotenv.config()

// Load configuration from environment variables
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

// Validate configuration
function validateConfig(): void {
  const requiredKeys = ['provider', 'buyer', 'verifier', 'lp']
  const missingKeys = requiredKeys.filter(key => !config.agentKeys[key as keyof typeof config.agentKeys])
  
  if (missingKeys.length > 0) {
    console.error('❌ Missing required environment variables:')
    missingKeys.forEach(key => {
      console.error(`   - ${key.toUpperCase()}_PK`)
    })
    console.error('\nPlease set these in your .env file or environment')
    process.exit(1)
  }
  
  console.log('✅ Configuration validated')
}

// Main function
async function main(): Promise<void> {
  console.log('🌙 Shadow Protocol Agent Orchestrator')
  console.log('=====================================')
  
  try {
    // Validate configuration
    validateConfig()
    
    // Create orchestrator
    const orchestrator = new AgentOrchestrator(config)
    
    // Setup event listeners
    orchestrator.on('started', () => {
      console.log('🎉 All agents are running!')
    })
    
    orchestrator.on('stopped', () => {
      console.log('👋 All agents stopped')
    })
    
    orchestrator.on('error', (error) => {
      console.error('💥 Orchestrator error:', error)
    })
    
    // Start orchestrator
    await orchestrator.start()
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...')
      await orchestrator.stop()
      process.exit(0)
    })
    
    // Health check endpoint (optional)
    if (process.env.ENABLE_HEALTH_CHECK === 'true') {
      const port = parseInt(process.env.HEALTH_CHECK_PORT || '3001')
      const { createServer } = await import('http')
      
      const server = createServer(async (req, res) => {
        if (req.url === '/health') {
          const health = await orchestrator.healthCheck()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(health, null, 2))
        } else {
          res.writeHead(404)
          res.end('Not Found')
        }
      })
      
      server.listen(port, () => {
        console.log(`🏥 Health check server running on port ${port}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Failed to start agent orchestrator:', error)
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the application
main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
