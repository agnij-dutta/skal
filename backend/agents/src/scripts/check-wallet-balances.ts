import { ethers } from 'ethers'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const RPC_URL = process.env.SOMNIA_RPC || process.env.FLOW_RPC || 'https://testnet.evm.nodes.onflow.org'

async function checkBalances() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  
  const wallets = [
    { name: 'Provider', address: process.env.PROVIDER_PK ? new ethers.Wallet(process.env.PROVIDER_PK).address : null },
    { name: 'Buyer', address: process.env.BUYER_PK ? new ethers.Wallet(process.env.BUYER_PK).address : null },
    { name: 'Verifier', address: process.env.VERIFIER_PK ? new ethers.Wallet(process.env.VERIFIER_PK).address : null },
    { name: 'LP', address: process.env.LP_PK ? new ethers.Wallet(process.env.LP_PK).address : null },
  ]

  console.log('💰 Checking wallet balances on Somnia...\n')
  console.log(`RPC: ${RPC_URL}\n`)

  let needsFunding: string[] = []
  let funded: string[] = []

  for (const wallet of wallets) {
    if (!wallet.address) {
      console.log(`⚠️  ${wallet.name}: No private key found in .env.local`)
      continue
    }

    try {
      const balance = await provider.getBalance(wallet.address)
      const balanceEth = ethers.formatEther(balance)
      const balanceNum = parseFloat(balanceEth)

      console.log(`${wallet.name}: ${wallet.address}`)
      console.log(`  Balance: ${balanceEth} STT`)
      
      if (balanceNum < 0.01) {
        console.log(`  ⚠️  LOW BALANCE - Needs funding!`)
        needsFunding.push(wallet.address)
      } else {
        console.log(`  ✅ Funded`)
        funded.push(wallet.address)
      }
      console.log()
    } catch (error: any) {
      console.log(`${wallet.name}: ${wallet.address}`)
      console.log(`  ❌ Error: ${error.message}`)
      console.log(`  ⚠️  Account may not exist yet - needs funding!`)
      needsFunding.push(wallet.address)
      console.log()
    }
  }

  if (needsFunding.length > 0) {
    console.log('\n📋 FUNDING INSTRUCTIONS:')
    console.log('='.repeat(60))
    console.log('These wallets need FLOW tokens to operate:')
    needsFunding.forEach(addr => console.log(`  - ${addr}`))
    console.log('\nTo fund on Somnia:')
    console.log('  1. Use a funded wallet (e.g., your main wallet)')
    console.log('  2. Send FLOW tokens to each address above')
    console.log('  3. Minimum recommended: 0.1 STT per wallet')
    console.log('  4. You can use a faucet if available, or transfer from another wallet')
    console.log('\nSomnia Testnet RPC:', RPC_URL)
    console.log('='.repeat(60))
  } else {
    console.log('✅ All wallets are funded!')
  }
}

checkBalances().catch(console.error)

