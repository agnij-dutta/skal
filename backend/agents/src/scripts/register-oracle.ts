#!/usr/bin/env node

import { ethers } from 'ethers'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.local') })

const ORACLE_REGISTRY_ABI = [
  'function registerOracle() external payable',
  'function isActiveOracle(address) external view returns (bool)',
  'function getOracle(address) external view returns (address, uint256, uint256, bool, uint256, uint256, uint256, uint256)',
  'function getActiveOracleCount() external view returns (uint256)',
  'event OracleRegistered(address indexed oracleAddress, uint256 stake, uint256 timestamp)'
]

async function registerOracle(
  privateKey: string,
  oracleName: string,
  stakeAmount: string
): Promise<void> {
  console.log(`\n🔮 Registering Oracle: ${oracleName}`)
  console.log('=' .repeat(50))
  
  try {
    // Setup provider and wallet
    const rpcUrl = process.env.SOMNIA_RPC || 'https://dream-rpc.somnia.network/'
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(privateKey, provider)
    
    console.log(`📍 RPC: ${rpcUrl}`)
    console.log(`🔑 Oracle Address: ${wallet.address}`)
    
    // Check balance
    const balance = await provider.getBalance(wallet.address)
    console.log(`💰 Balance: ${ethers.formatEther(balance)} STT`)
    
    const stake = ethers.parseEther(stakeAmount)
    if (balance < stake) {
      console.error(`❌ Insufficient balance. Need ${stakeAmount} STT, have ${ethers.formatEther(balance)} STT`)
      return
    }
    
    // Get oracle registry address
    const oracleRegistryAddress = process.env.ORACLE_REGISTRY
    if (!oracleRegistryAddress || oracleRegistryAddress === '0x0000000000000000000000000000000000000000') {
      console.error('❌ ORACLE_REGISTRY address not set in environment')
      console.error('Please deploy oracle contracts first')
      return
    }
    
    console.log(`📋 Oracle Registry: ${oracleRegistryAddress}`)
    
    // Connect to oracle registry
    const oracleRegistry = new ethers.Contract(
      oracleRegistryAddress,
      ORACLE_REGISTRY_ABI,
      wallet
    )
    
    // Check if already registered
    const isRegistered = await oracleRegistry.isActiveOracle(wallet.address)
    if (isRegistered) {
      console.log('✅ Oracle is already registered and active!')
      
      // Get oracle details
      const details = await oracleRegistry.getOracle(wallet.address)
      console.log('\nOracle Details:')
      console.log(`  Stake: ${ethers.formatEther(details[1])} STT`)
      console.log(`  Reputation: ${details[2]}`)
      console.log(`  Successful Validations: ${details[4]}`)
      console.log(`  Total Validations: ${details[5]}`)
      console.log(`  Success Rate: ${details[5] > 0 ? ((Number(details[4]) / Number(details[5])) * 100).toFixed(1) : 0}%`)
      
      return
    }
    
    console.log(`\n🚀 Registering with stake: ${stakeAmount} STT`)
    console.log('⏳ Submitting transaction...')
    
    // Register oracle
    const tx = await oracleRegistry.registerOracle({
      value: stake,
      gasLimit: 500000
    })
    
    console.log(`📤 Transaction hash: ${tx.hash}`)
    console.log('⏳ Waiting for confirmation...')
    
    const receipt = await tx.wait()
    
    if (receipt && receipt.status === 1) {
      console.log(`✅ Oracle registered successfully!`)
      console.log(`📦 Block: ${receipt.blockNumber}`)
      console.log(`⛽ Gas used: ${receipt.gasUsed}`)
      
      // Get updated count
      const activeCount = await oracleRegistry.getActiveOracleCount()
      console.log(`\n📊 Total Active Oracles: ${activeCount}`)
      
      // Get oracle details
      const details = await oracleRegistry.getOracle(wallet.address)
      console.log('\nYour Oracle Details:')
      console.log(`  Address: ${wallet.address}`)
      console.log(`  Stake: ${ethers.formatEther(details[1])} STT`)
      console.log(`  Reputation: ${details[2]} (starts at 50)`)
      console.log(`  Status: Active`)
      
      console.log('\n✅ Oracle is ready to verify tasks!')
    } else {
      console.error('❌ Registration failed - transaction reverted')
    }
    
  } catch (error: any) {
    console.error('\n❌ Error registering oracle:', error.message)
    if (error.data) {
      console.error('Error data:', error.data)
    }
  }
}

async function registerAllOracles(): Promise<void> {
  console.log('\n🔮 Oracle Network Registration')
  console.log('=' .repeat(50))
  
  const stakeAmount = process.env.ORACLE_STAKE_AMOUNT || '0.1'
  const oracleCount = parseInt(process.env.MIN_ORACLES || '3')
  
  console.log(`\n📊 Configuration:`)
  console.log(`  Stake per Oracle: ${stakeAmount} STT`)
  console.log(`  Number of Oracles: ${oracleCount}`)
  
  // Register each oracle
  for (let i = 1; i <= oracleCount; i++) {
    const oracleKey = process.env[`ORACLE_${i}_PK`]
    
    if (!oracleKey) {
      console.warn(`\n⚠️  ORACLE_${i}_PK not found in environment, skipping...`)
      continue
    }
    
    await registerOracle(oracleKey, `Oracle ${i}`, stakeAmount)
    
    // Small delay between registrations
    if (i < oracleCount) {
      console.log('\n⏳ Waiting 2 seconds before next registration...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n✅ All oracles registered!')
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    // Register all oracles from environment
    await registerAllOracles()
  } else if (args[0] === '--single' && args.length >= 3) {
    // Register single oracle: --single <privateKey> <stakeAmount>
    const privateKey = args[1]
    const stakeAmount = args[2]
    await registerOracle(privateKey, 'Single Oracle', stakeAmount)
  } else if (args[0] === '--help' || args[0] === '-h') {
    console.log('\nUsage:')
    console.log('  npm run register:oracles                    # Register all oracles from .env.local')
    console.log('  npm run register:oracles -- --single <PK> <amount>  # Register single oracle')
    console.log('\nEnvironment variables required:')
    console.log('  ORACLE_REGISTRY        - Oracle registry contract address')
    console.log('  ORACLE_1_PK            - Private key for oracle 1')
    console.log('  ORACLE_2_PK            - Private key for oracle 2')
    console.log('  ORACLE_3_PK            - Private key for oracle 3')
    console.log('  ORACLE_STAKE_AMOUNT    - Stake amount per oracle (default: 0.1)')
    console.log('  MIN_ORACLES            - Number of oracles to register (default: 3)')
  } else {
    console.error('Invalid arguments. Use --help for usage information.')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})






