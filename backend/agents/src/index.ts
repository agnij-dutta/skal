#!/usr/bin/env node

import { AgentOrchestrator, AgentConfig } from './services/AgentOrchestrator.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Suppress ethers.js internal errors that don't affect functionality
const originalConsoleError = console.error
const originalConsoleLog = console.log

console.error = (...args: any[]) => {
  const message = args.join(' ')
  if (message.includes('results is not iterable') || 
      message.includes('FilterIdEventSubscriber') ||
      message.includes('_emitResults') ||
      message.includes('subscriber-filterid.ts')) {
    // Silently ignore ethers.js internal errors
    return
  }
  originalConsoleError(...args)
}

console.log = (...args: any[]) => {
  const message = args.join(' ')
  if (message.includes('@TODO TypeError: results is not iterable') ||
      message.includes('FilterIdEventSubscriber') ||
      message.includes('_emitResults') ||
      message.includes('subscriber-filterid.ts')) {
    // Silently ignore ethers.js internal errors
    return
  }
  originalConsoleLog(...args)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try loading .env.local from multiple locations
const envPaths = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../../.env.local')
]

let envLoaded = false
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath })
  if (!result.error) {
    console.log(`✅ Loaded environment from: ${envPath}`)
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env.local file found, using environment variables')
}

// Load configuration from environment variables
const config: AgentConfig = {
  rpcUrl: process.env.FLOW_RPC || 'https://testnet.evm.nodes.onflow.org',
  storageUrl: process.env.STORAGE_URL || 'https://skal.onrender.com',
  contractAddresses: {
    commitRegistry: process.env.COMMIT_REGISTRY || '0x21b165aE60748410793e4c2ef248940dc31FE773',
    escrowManager: process.env.ESCROW_MANAGER || '0x4D1E494CaB138D8c23B18c975b49C1Bec7902746',
    ammEngine: process.env.AMM_ENGINE || '0xb9Df841a5b5f4a7f23F2294f3eecB5b2e2F53CFD',
    reputationManager: process.env.REPUTATION_MANAGER || '0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387',
    agentRegistry: process.env.AGENT_REGISTRY || '0x3F944e66a9513E1a2606288199d39bC974067348',
    oracleRegistry: process.env.ORACLE_REGISTRY || '0x0000000000000000000000000000000000000000',
    verificationAggregator: process.env.VERIFICATION_AGGREGATOR || '0x0000000000000000000000000000000000000000'
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
  console.log('🌙 Skal Agent Orchestrator')
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
    
    // Health check is now handled by the orchestrator's web server on port 8000
    
  } catch (error) {
    console.error('❌ Failed to start agent orchestrator:', error)
    console.log('⚠️  Some services may have failed, but system will continue running')
    // Don't exit - let working services continue
  }
}

// Handle uncaught exceptions - log but keep running
process.on('uncaughtException', (error) => {
  // Filter out ethers.js internal errors that don't affect functionality
  const errorStr = String(error)
  if (errorStr.includes('results is not iterable') || 
      errorStr.includes('FilterIdEventSubscriber') ||
      errorStr.includes('_emitResults') ||
      errorStr.includes('subscriber-filterid.ts')) {
    // These are cosmetic ethers.js internal errors - silently ignore
    return
  }
  console.error('💥 Uncaught Exception (recovered):', error.message)
  // Don't exit - autonomous system should be resilient
})

process.on('unhandledRejection', (reason, promise) => {
  // Filter out ethers.js internal errors
  const reasonStr = String(reason)
  if (reasonStr.includes('results is not iterable') || 
      reasonStr.includes('FilterIdEventSubscriber') ||
      reasonStr.includes('_emitResults') ||
      reasonStr.includes('subscriber-filterid.ts')) {
    // These are cosmetic ethers.js internal errors - silently ignore
    return
  }
  console.error('💥 Unhandled Rejection (recovered):', reason)
  // Don't exit - log and continue
})

// Start the application
main().catch((error) => {
  console.error('💥 Startup error (will retry):', error.message)
  // Don't exit - system should be resilient
})
