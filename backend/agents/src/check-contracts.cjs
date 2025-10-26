#!/usr/bin/env node

const { ethers } = require('ethers')
const dotenv = require('dotenv')
const path = require('path')

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.local') })

const RPC_URL = 'https://dream-rpc.somnia.network/'

// Contract addresses from .env.local
const CONTRACTS = {
  COMMIT_REGISTRY: process.env.COMMIT_REGISTRY || '0xB94ecC5a4cA8D7D2749cE8353F03B38372235C26',
  ESCROW_MANAGER: process.env.ESCROW_MANAGER || '0x8F9Cce60CDa5c3b262c30321f40a180A6A9DA762',
  AMM_ENGINE: process.env.AMM_ENGINE || '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC',
  REPUTATION_MANAGER: process.env.REPUTATION_MANAGER || '0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8',
  AGENT_REGISTRY: process.env.AGENT_REGISTRY || '0x2CC077f1Da27e7e08A1832804B03b30A2990a61C',
  ORACLE_REGISTRY: process.env.ORACLE_REGISTRY || '0x0000000000000000000000000000000000000000',
  VERIFICATION_AGGREGATOR: process.env.VERIFICATION_AGGREGATOR || '0x0000000000000000000000000000000000000000'
}

// Contract addresses from dapp config
const DAPP_CONTRACTS = {
  COMMIT_REGISTRY: '0x8D7cd1c2bEcA4eb4cE7aa0fA37eCB61ea125171f',
  ESCROW_MANAGER: '0x5952b85E23388130A0D2C34B1151A4d60414d998',
  AMM_ENGINE: '0x463f717e81182B3949b7d0382d30471984921f2f',
  REPUTATION_MANAGER: '0xd1077A0D78b8F6969f16c7409CdaB566B6d62486',
  AGENT_REGISTRY: '0x4cc020E6eC340401cdb4f89fC09E5ad3920E5E46',
  ORACLE_REGISTRY: '0x7D13E10a328c00fb40da626eBF524bd0BFdF5350',
  VERIFICATION_AGGREGATOR: '0xE949fa1A74D18E7888704B5e6E722b9a920AFE28'
}

async function checkContractActivity() {
  console.log('🔍 Checking Contract Activity and Address Consistency')
  console.log('='.repeat(60))
  
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  
  // Compare addresses
  console.log('\n📋 Address Comparison:')
  console.log('Contract'.padEnd(20) + 'Backend'.padEnd(45) + 'Dapp'.padEnd(45) + 'Match')
  console.log('-'.repeat(120))
  
  for (const [name, backendAddr] of Object.entries(CONTRACTS)) {
    const dappAddr = DAPP_CONTRACTS[name]
    const match = backendAddr.toLowerCase() === dappAddr.toLowerCase()
    console.log(
      name.padEnd(20) + 
      backendAddr.padEnd(45) + 
      dappAddr.padEnd(45) + 
      (match ? '✅' : '❌')
    )
  }
  
  // Check which contracts have activity
  console.log('\n📊 Contract Activity Analysis:')
  console.log('-'.repeat(60))
  
  for (const [name, address] of Object.entries(CONTRACTS)) {
    if (address === '0x0000000000000000000000000000000000000000') {
      console.log(`${name.padEnd(20)}: ⚠️  Not deployed`)
      continue
    }
    
    try {
      // Check if contract has code
      const code = await provider.getCode(address)
      if (code === '0x') {
        console.log(`${name.padEnd(20)}: ❌ No contract code`)
        continue
      }
      
      // Get recent events (last 1000 blocks)
      const currentBlock = await provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 1000)
      
      // Try to get events for common functions
      let eventCount = 0
      try {
        // TaskCommitted events
        const taskCommittedFilter = {
          address: address,
          topics: [ethers.id('TaskCommitted(uint256,address,bytes32,uint256,uint256)')],
          fromBlock: fromBlock,
          toBlock: 'latest'
        }
        const taskEvents = await provider.getLogs(taskCommittedFilter)
        eventCount += taskEvents.length
        
        // FundsLocked events
        const fundsLockedFilter = {
          address: address,
          topics: [ethers.id('FundsLocked(uint256,address,uint256)')],
          fromBlock: fromBlock,
          toBlock: 'latest'
        }
        const fundsEvents = await provider.getLogs(fundsLockedFilter)
        eventCount += fundsEvents.length
        
        // TaskRevealed events
        const taskRevealedFilter = {
          address: address,
          topics: [ethers.id('TaskRevealed(uint256,string)')],
          fromBlock: fromBlock,
          toBlock: 'latest'
        }
        const revealEvents = await provider.getLogs(taskRevealedFilter)
        eventCount += revealEvents.length
        
        // LiquidityAdded events
        const liquidityAddedFilter = {
          address: address,
          topics: [ethers.id('LiquidityAdded(uint256,address,uint256,uint256)')],
          fromBlock: fromBlock,
          toBlock: 'latest'
        }
        const liquidityEvents = await provider.getLogs(liquidityAddedFilter)
        eventCount += liquidityEvents.length
        
        // OracleRegistered events
        const oracleRegisteredFilter = {
          address: address,
          topics: [ethers.id('OracleRegistered(address,uint256,uint256)')],
          fromBlock: fromBlock,
          toBlock: 'latest'
        }
        const oracleEvents = await provider.getLogs(oracleRegisteredFilter)
        eventCount += oracleEvents.length
        
      } catch (error) {
        // Some contracts might not have these events
      }
      
      console.log(`${name.padEnd(20)}: ✅ Active (${eventCount} recent events)`)
      
    } catch (error) {
      console.log(`${name.padEnd(20)}: ❌ Error checking - ${error.message}`)
    }
  }
  
  // Check total tasks
  console.log('\n📈 Task Statistics:')
  console.log('-'.repeat(40))
  
  try {
    const commitRegistry = new ethers.Contract(
      CONTRACTS.COMMIT_REGISTRY,
      ['function getTotalTasks() view returns (uint256)'],
      provider
    )
    
    const totalTasks = await commitRegistry.getTotalTasks()
    console.log(`Total Tasks Created: ${totalTasks}`)
    
    // Check recent tasks
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 1000)
    
    const taskCommittedFilter = {
      address: CONTRACTS.COMMIT_REGISTRY,
      topics: [ethers.id('TaskCommitted(uint256,address,bytes32,uint256,uint256)')],
      fromBlock: fromBlock,
      toBlock: 'latest'
    }
    
    const recentTasks = await provider.getLogs(taskCommittedFilter)
    console.log(`Recent Tasks (last 1000 blocks): ${recentTasks.length}`)
    
  } catch (error) {
    console.log(`❌ Error getting task stats: ${error.message}`)
  }
  
  console.log('\n🎯 Summary:')
  console.log('-'.repeat(40))
  
  const mismatches = Object.keys(CONTRACTS).filter(name => {
    const backendAddr = CONTRACTS[name]
    const dappAddr = DAPP_CONTRACTS[name]
    return backendAddr.toLowerCase() !== dappAddr.toLowerCase()
  })
  
  if (mismatches.length > 0) {
    console.log(`❌ ${mismatches.length} contract address mismatches found:`)
    mismatches.forEach(name => console.log(`   - ${name}`))
    console.log('\n💡 Recommendation: Update .env.local with correct addresses')
  } else {
    console.log('✅ All contract addresses match between backend and dapp')
  }
}

checkContractActivity().catch(console.error)
