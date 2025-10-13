#!/usr/bin/env node

import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function simpleTest() {
  console.log('🧪 Simple Contract Test...')
  
  try {
    // Connect to network
    const provider = new ethers.JsonRpcProvider(process.env.SOMNIA_RPC || 'https://dream-rpc.somnia.network/')
    const wallet = new ethers.Wallet(process.env.PROVIDER_PK || '', provider)
    
    console.log('🔑 Wallet:', wallet.address)
    console.log('💰 Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH')
    
    // Test CommitRegistry
    console.log('\n📋 Testing CommitRegistry...')
    const commitRegistry = new ethers.Contract(
      process.env.COMMIT_REGISTRY || '0xB94ecC5a4cA8D7D2749cE8353F03B38372235C26',
      [
        'function getTotalTasks() view returns (uint256)',
        'function commitTask(bytes32 commitHash, uint256 marketId, uint256 stake) payable returns (uint256)'
      ],
      wallet
    )
    
    // Test read function
    const totalTasks = await commitRegistry.getTotalTasks()
    console.log(`  Total Tasks: ${totalTasks}`)
    
    // First, let's create a market
    console.log('\n🏪 Testing createMarket...')
    const ammEngine = new ethers.Contract(
      process.env.AMM_ENGINE || '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC',
      [
        'function createMarket(uint256 marketId, address tokenA, address tokenB) external',
        'function getMarket(uint256 marketId) view returns (tuple(uint256 marketId, address tokenA, address tokenB, uint256 reserveA, uint256 reserveB, uint256 totalSupply, bool active, uint256 createdAt))'
      ],
      wallet
    )
    
    const marketId = 1
    const tokenA = '0x0000000000000000000000000000000000000000' // STT (Somnia Test Token)
    const tokenB = '0x0000000000000000000000000000000000000000' // STT as both tokens for now
    
    try {
      // Check if market exists
      const market = await ammEngine.getMarket(marketId)
      if (market.active) {
        console.log(`  ✅ Market ${marketId} already exists`)
      } else {
        console.log(`  📝 Creating market ${marketId}...`)
        const tx = await ammEngine.createMarket(marketId, tokenA, tokenB, {
          gasLimit: 500000
        })
        
        console.log(`  ✅ Market creation sent: ${tx.hash}`)
        const receipt = await tx.wait()
        if (receipt) {
          console.log(`  ✅ Market created in block ${receipt.blockNumber}`)
        }
      }
    } catch (error) {
      console.log(`  ❌ Market creation failed: ${error}`)
    }
    
    // Now test commitTask
    console.log('\n📝 Testing commitTask...')
    const commitHash = ethers.keccak256(ethers.toUtf8Bytes('test' + Date.now()))
    const stake = ethers.parseEther('0.01') // Small amount
    
    console.log(`  Commit Hash: ${commitHash}`)
    console.log(`  Market ID: ${marketId}`)
    console.log(`  Stake: ${ethers.formatEther(stake)} STT`)
    
    try {
      // First, let's estimate gas
      console.log(`  🔍 Estimating gas...`)
      const gasEstimate = await commitRegistry.commitTask.estimateGas(commitHash, marketId, stake, {
        value: stake
      })
      console.log(`  Gas estimate: ${gasEstimate}`)
      
      const tx = await commitRegistry.commitTask(commitHash, marketId, stake, {
        value: stake,
        gasLimit: gasEstimate * 2n // Use 2x estimate for safety
      })
      
      console.log(`  ✅ Transaction sent: ${tx.hash}`)
      
      // Wait for confirmation
      const receipt = await tx.wait()
      if (receipt) {
        console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`)
        console.log(`  Gas used: ${receipt.gasUsed}`)
      }
      
    } catch (error) {
      console.log(`  ❌ Transaction failed: ${error}`)
      
      // Try to get more details
      if (error.data) {
        console.log(`  Error data: ${error.data}`)
      }
      if (error.reason) {
        console.log(`  Error reason: ${error.reason}`)
      }
      if (error.message) {
        console.log(`  Error message: ${error.message}`)
      }
      
      // Try to decode revert reason if available
      if (error.data && error.data.length > 2) {
        try {
          const revertReason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + error.data.slice(10))
          console.log(`  Revert reason: ${revertReason[0]}`)
        } catch (decodeError) {
          console.log(`  Could not decode revert reason: ${decodeError}`)
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

simpleTest()
