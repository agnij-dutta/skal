import 'dotenv/config'
import fetch from 'node-fetch'
import { Agent } from './core/Agent'
import { Contract, parseEther } from 'ethers'

const COMMIT_REGISTRY = process.env.COMMIT_REGISTRY!
const SOMNIA_RPC = process.env.SOMNIA_RPC!
const PROVIDER_PK = process.env.PROVIDER_PK!

const ABI = [
  'function commitTask(bytes32 commitHash, uint256 marketId, uint256 stake) payable returns (uint256)'
]

class ProviderAgent extends Agent {
  private registry: Contract
  constructor(rpc: string, pk: string, registryAddr: string) {
    super(rpc, pk)
    this.registry = new Contract(registryAddr, ABI, this.wallet)
  }

  async prepareAndCommit(data: any, marketId: bigint, stakeEth: string) {
    const STORAGE_URL = process.env.STORAGE_URL || 'http://localhost:8787'
    const form = new URLSearchParams()
    form.set('data', JSON.stringify(data))
    form.set('policyId', 'policy_v1')
    form.set('provider', this.wallet.address)
    const resp = await fetch(`${STORAGE_URL}/encrypt-upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString()
    })
    if (!resp.ok) throw new Error('encrypt-upload failed')
    const { cid, commitHash } = await resp.json()
    const stake = parseEther(stakeEth)
    const tx = await this.registry.commitTask(commitHash, marketId, stake, { value: stake })
    const rc = await tx.wait()
    console.log('Committed task', { cid, tx: rc?.hash })
  }
}

async function main() {
  const agent = new ProviderAgent(SOMNIA_RPC, PROVIDER_PK, COMMIT_REGISTRY)
  await agent.prepareAndCommit({ sample: 'shadow payload', t: Date.now() }, BigInt(process.env.MARKET_ID || '1'), process.env.STAKE_ETH || '0.05')
}

main().catch(e => { console.error(e); process.exit(1) })



