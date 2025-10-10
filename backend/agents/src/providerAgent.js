import 'dotenv/config'
import { ethers } from 'ethers'
import fetch from 'node-fetch'

// Minimal provider agent: encrypts/pins via storage service, then commits

const STORAGE_URL = process.env.STORAGE_URL || 'http://localhost:8787'
const SOMNIA_RPC = process.env.SOMNIA_RPC || 'http://127.0.0.1:8545'
const PRIVATE_KEY = process.env.PROVIDER_PK
const COMMIT_REGISTRY = process.env.COMMIT_REGISTRY

const ABI = [
  'function commitTask(bytes32 commitHash, uint256 marketId, uint256 stake) payable returns (uint256)'
]

async function main() {
  if (!PRIVATE_KEY || !COMMIT_REGISTRY) {
    console.error('Missing PROVIDER_PK or COMMIT_REGISTRY in env')
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(SOMNIA_RPC)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const registry = new ethers.Contract(COMMIT_REGISTRY, ABI, wallet)

  const data = JSON.stringify({ sample: 'shadow test payload', t: Date.now() })
  const form = new URLSearchParams()
  form.set('data', data)
  form.set('policyId', 'policy_v1')
  form.set('provider', wallet.address)

  const resp = await fetch(`${STORAGE_URL}/encrypt-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  })
  if (!resp.ok) throw new Error('encrypt-upload failed')
  const { cid, commitHash } = await resp.json()

  const marketId = BigInt(process.env.MARKET_ID || '1')
  const stakeWei = ethers.parseEther(process.env.STAKE_ETH || '0.05')

  console.log('Committing...', { cid, commitHash, marketId: marketId.toString(), stakeWei: stakeWei.toString() })
  const tx = await registry.commitTask(commitHash, marketId, stakeWei, { value: stakeWei })
  const receipt = await tx.wait()
  console.log('Commit tx mined', receipt?.hash)
}

main().catch((e) => { console.error(e); process.exit(1) })


