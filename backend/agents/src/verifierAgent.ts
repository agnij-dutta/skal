import 'dotenv/config'
import { Agent } from './core/Agent'
import { Contract } from 'ethers'

const SOMNIA_RPC = process.env.SOMNIA_RPC!
const VERIFIER_PK = process.env.VERIFIER_PK!
const COMMIT_REGISTRY = process.env.COMMIT_REGISTRY!

const ABI = [
  'event TaskRevealed(uint256 indexed taskId, string cid, uint256 timestamp)',
  'function finalizeValidation(uint256 taskId, uint8 score, address verifier, bytes signature)'
]

class VerifierAgent extends Agent {
  private registry: Contract
  constructor(rpc: string, pk: string, registryAddr: string) {
    super(rpc, pk)
    this.registry = new Contract(registryAddr, ABI, this.wallet)
  }
  run() {
    const topic = this.registry.interface.getEvent('TaskRevealed').topicHash
    this.provider.on({ address: COMMIT_REGISTRY, topics: [topic] }, async (log) => {
      try {
        const parsed = this.registry.interface.parseLog(log)
        const taskId: bigint = parsed.args[0]
        const cid: string = parsed.args[1]
        const score = await this.computeScore(cid)
        const signature = '0x'
        const tx = await this.registry.finalizeValidation(taskId, score, this.wallet.address, signature)
        const rc = await tx.wait()
        console.log('Validated', taskId.toString(), 'score', score, rc?.hash)
      } catch (e) { console.error('verify', e) }
    })
  }
  private async computeScore(cid: string): Promise<number> {
    const n = [...Buffer.from(cid)].reduce((a, b) => (a + b) % 101, 0)
    return Math.max(50, n)
  }
}

function main() {
  const agent = new VerifierAgent(SOMNIA_RPC, VERIFIER_PK, COMMIT_REGISTRY)
  agent.run()
  console.log('Verifier listening for TaskRevealed...')
}

main()



