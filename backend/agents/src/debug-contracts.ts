#!/usr/bin/env node

import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function debugContracts() {
  console.log('🔍 Debugging Contract State...')
  
  try {
    // Connect to network
    const provider = new ethers.JsonRpcProvider(process.env.SOMNIA_RPC || 'https://dream-rpc.somnia.network/')
    const wallet = new ethers.Wallet(process.env.PROVIDER_PK || '', provider)
    
    console.log('🔑 Wallet:', wallet.address)
    console.log('💰 Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH')
    
    // Check contract addresses
    const contracts = {
      commitRegistry: process.env.COMMIT_REGISTRY || '0xB94ecC5a4cA8D7D2749cE8353F03B38372235C26',
      escrowManager: process.env.ESCROW_MANAGER || '0x8F9Cce60CDa5c3b262c30321f40a180A6A9DA762',
      ammEngine: process.env.AMM_ENGINE || '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC',
    }
    
    console.log('\n📋 Contract Addresses:')
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`  ${name}: ${address}`)
    })
    
    // Check if contracts exist
    console.log('\n🔍 Checking Contract Code:')
    for (const [name, address] of Object.entries(contracts)) {
      try {
        const code = await provider.getCode(address)
        console.log(`  ${name}: ${code === '0x' ? '❌ No code' : '✅ Contract exists'}`)
      } catch (error) {
        console.log(`  ${name}: ❌ Error - ${error}`)
      }
    }
    
    // Try a simple read operation
    console.log('\n📖 Testing Contract Reads:')
    try {
      // Simple test - check if we can call a view function
      const commitRegistry = new ethers.Contract(
        contracts.commitRegistry,
        ['function getTotalTasks() view returns (uint256)'],
        provider
      )
      
      const totalTasks = await commitRegistry.getTotalTasks()
      console.log(`  Total Tasks: ${totalTasks}`)
    } catch (error) {
      console.log(`  ❌ Read test failed: ${error}`)
    }
    
    // Check network
    console.log('\n🌐 Network Info:')
    const network = await provider.getNetwork()
    console.log(`  Chain ID: ${network.chainId}`)
    console.log(`  Name: ${network.name}`)
    
    // Check latest block
    const block = await provider.getBlock('latest')
    console.log(`  Latest Block: ${block?.number}`)
    
  } catch (error) {
    console.error('💥 Debug failed:', error)
  }
}

debugContracts()
