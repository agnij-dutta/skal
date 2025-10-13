#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

console.log('Environment variables:')
console.log('PROVIDER_PK:', process.env.PROVIDER_PK)
console.log('Length:', process.env.PROVIDER_PK?.length)
console.log('Type:', typeof process.env.PROVIDER_PK)

// Test wallet creation
import { ethers } from 'ethers'

try {
  const wallet = new ethers.Wallet(process.env.PROVIDER_PK || '')
  console.log('Wallet created successfully:', wallet.address)
} catch (error) {
  console.error('Wallet creation failed:', error)
}
