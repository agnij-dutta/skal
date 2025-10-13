#!/usr/bin/env node

import { ethers } from 'ethers'
import dotenv from 'dotenv'
import { COMMIT_REGISTRY_ABI } from '../../../lib/contracts/abis/commitRegistry.js'

dotenv.config({ path: '.env.local' })

async function testRevealTask() {
  console.log('🔍 Testing revealTask function...')

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

  if (!commitRegistryAddress) {
    console.error('❌ Missing contract addresses in .env.local')
    return
  }

  const commitRegistry = new ethers.Contract(commitRegistryAddress, COMMIT_REGISTRY_ABI, wallet)

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
      console.log('  Task State:', task.state.toString())
      console.log('  Task Provider:', task.provider)
      console.log('  Task Market ID:', task.marketId.toString())
      console.log('  Task Stake:', ethers.formatEther(task.stake), 'STT')
      console.log('  Reveal Deadline:', new Date(Number(task.revealDeadline) * 1000).toISOString())
      
      // Check if we can reveal
      const canReveal = await (commitRegistry as any).canReveal(latestTaskId)
      console.log('  Can Reveal:', canReveal)
      
      if (canReveal) {
        // Test revealTask
        console.log('\n🔓 Testing revealTask...')
        const mockCid = 'Qm' + Math.random().toString(36).substring(2, 15)
        console.log('  Mock CID:', mockCid)
        
        try {
          // First estimate gas
          const gasEstimate = await (commitRegistry as any).revealTask.estimateGas(
            latestTaskId,
            mockCid
          )
          console.log('  Gas estimate:', gasEstimate.toString())
          
          const tx = await (commitRegistry as any).revealTask(
            latestTaskId,
            mockCid,
            {
              gasLimit: gasEstimate * 2n
            }
          )
          
          console.log('  ✅ Transaction sent:', tx.hash)
          
          const receipt = await tx.wait()
          if (receipt) {
            console.log('  ✅ Transaction confirmed in block', receipt.blockNumber)
            console.log('  Gas used:', receipt.gasUsed.toString())
          }
          
        } catch (error) {
          console.log('  ❌ revealTask failed:', error.message || error)
          
          // Try to get more details
          if (error.data) {
            console.log('  Error data:', error.data)
          }
          if (error.reason) {
            console.log('  Error reason:', error.reason)
          }
        }
      } else {
        console.log('  ❌ Cannot reveal task - not in correct state or deadline passed')
      }
    } else {
      console.log('  No tasks found to test with')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testRevealTask().catch(console.error)
