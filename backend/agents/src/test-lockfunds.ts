#!/usr/bin/env node

import { ethers } from 'ethers'
import dotenv from 'dotenv'
import { COMMIT_REGISTRY_ABI } from '../../../lib/contracts/abis/commitRegistry.js'
import { ESCROW_MANAGER_ABI } from '../../../lib/contracts/abis/escrowManager.js'

dotenv.config({ path: '.env.local' })

async function testLockFunds() {
  console.log('🔍 Testing lockFunds function...')

  const rpcUrl = process.env.SOMNIA_RPC || 'https://dream-rpc.somnia.network/'
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const privateKey = process.env.PROVIDER_PK
  if (!privateKey) {
    console.error('❌ PROVIDER_PK not found in .env.local')
    return
  }
  const wallet = new ethers.Wallet(privateKey, provider)

  console.log('🔑 Wallet:', wallet.address)
  console.log('💰 Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'STT')

  const commitRegistryAddress = process.env.COMMIT_REGISTRY
  const escrowManagerAddress = process.env.ESCROW_MANAGER

  if (!commitRegistryAddress || !escrowManagerAddress) {
    console.error('❌ Missing contract addresses in .env.local')
    return
  }

  const commitRegistry = new ethers.Contract(commitRegistryAddress, COMMIT_REGISTRY_ABI, wallet)
  const escrowManager = new ethers.Contract(escrowManagerAddress, ESCROW_MANAGER_ABI, wallet)

  // Get the latest task ID
  console.log('\n📋 Getting latest task...')
  try {
    const totalTasks = await (commitRegistry as any).getTotalTasks()
    console.log('  Total Tasks:', totalTasks.toString())
    
    if (totalTasks > 0) {
      const latestTaskId = totalTasks - 1n
      console.log('  Latest Task ID:', latestTaskId.toString())
      
      // Get task details
      const task = await (commitRegistry as any).getTask(latestTaskId)
      console.log('  Task State:', task.state)
      console.log('  Task Provider:', task.provider)
      console.log('  Task Market ID:', task.marketId.toString())
      console.log('  Task Stake:', ethers.formatEther(task.stake), 'STT')
      
      // Test lockFunds
      console.log('\n🔒 Testing lockFunds...')
      const escrowAmount = ethers.parseEther('0.01') // 0.01 STT
      
      try {
        // First estimate gas
        const gasEstimate = await (escrowManager as any).lockFunds.estimateGas(
          latestTaskId,
          {
            value: escrowAmount
          }
        )
        console.log('  Gas estimate:', gasEstimate.toString())
        
        const tx = await (escrowManager as any).lockFunds(
          latestTaskId,
          {
            gasLimit: gasEstimate * 2n,
            value: escrowAmount
          }
        )
        
        console.log('  ✅ Transaction sent:', tx.hash)
        
        const receipt = await tx.wait()
        if (receipt) {
          console.log('  ✅ Transaction confirmed in block', receipt.blockNumber)
          console.log('  Gas used:', receipt.gasUsed.toString())
        }
        
      } catch (error) {
        console.log('  ❌ lockFunds failed:', error.message || error)
        
        // Try to get more details
        if (error.data) {
          console.log('  Error data:', error.data)
        }
        if (error.reason) {
          console.log('  Error reason:', error.reason)
        }
      }
    } else {
      console.log('  No tasks found to test with')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testLockFunds().catch(console.error)
