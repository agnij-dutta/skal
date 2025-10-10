import 'dotenv/config'
import { Agent } from './core/Agent'
import { Contract, parseEther } from 'ethers'

const SOMNIA_RPC = process.env.SOMNIA_RPC!
const BUYER_PK = process.env.BUYER_PK!
const ESCROW_MANAGER = process.env.ESCROW_MANAGER!

const ABI = [ 'function lockFunds(uint256 taskId) payable' ]

class BuyerAgent extends Agent {
  private escrow: Contract
  constructor(rpc: string, pk: string, escrowAddr: string) {
    super(rpc, pk)
    this.escrow = new Contract(escrowAddr, ABI, this.wallet)
  }
  async lock(taskId: bigint, amountEth: string) {
    const value = parseEther(amountEth)
    const tx = await this.escrow.lockFunds(taskId, { value })
    const rc = await tx.wait()
    console.log('Locked funds', { taskId: taskId.toString(), tx: rc?.hash })
  }
}

async function main() {
  const taskId = BigInt(process.argv[2] || '0')
  const amount = process.argv[3] || process.env.BUY_AMOUNT_ETH || '0.05'
  const agent = new BuyerAgent(SOMNIA_RPC, BUYER_PK, ESCROW_MANAGER)
  await agent.lock(taskId, amount)
}

main().catch(e => { console.error(e); process.exit(1) })



