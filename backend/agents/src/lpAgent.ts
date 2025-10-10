import 'dotenv/config'
import { Agent } from './core/Agent'
import { Contract, parseEther } from 'ethers'

const SOMNIA_RPC = process.env.SOMNIA_RPC!
const LP_PK = process.env.LP_PK!
const AMM_ENGINE = process.env.AMM_ENGINE!

const ABI = [
  'function addLiquidity(uint256 marketId, uint256 amountA, uint256 amountB) payable',
  'function removeLiquidity(uint256 marketId, uint256 lpTokens)',
  'function getUserLPTokens(address user, uint256 marketId) view returns (uint256)'
]

class LPAgent extends Agent {
  private amm: Contract
  constructor(rpc: string, pk: string, ammAddr: string) {
    super(rpc, pk)
    this.amm = new Contract(ammAddr, ABI, this.wallet)
  }
  async add(marketId: bigint, amountAEth: string, amountB: bigint) {
    const amountA = parseEther(amountAEth)
    const tx = await this.amm.addLiquidity(marketId, amountA, amountB, { value: amountA })
    const rc = await tx.wait()
    console.log('LP add', rc?.hash)
  }
  async remove(marketId: bigint) {
    const lp: bigint = await this.amm.getUserLPTokens(this.wallet.address, marketId)
    if (lp === 0n) return console.log('No LP tokens')
    const tx = await this.amm.removeLiquidity(marketId, lp)
    const rc = await tx.wait()
    console.log('LP remove', rc?.hash)
  }
}

async function main() {
  const agent = new LPAgent(SOMNIA_RPC, LP_PK, AMM_ENGINE)
  const action = process.argv[2] || 'add'
  const marketId = BigInt(process.env.LP_MARKET_ID || '1')
  if (action === 'add') return agent.add(marketId, process.env.LP_AMOUNT_A_ETH || '0.2', BigInt(process.env.LP_AMOUNT_B || '1000000000000000000'))
  if (action === 'remove') return agent.remove(marketId)
  console.error('Usage: npm run dev:lp -- [add|remove]')
}

main().catch(e => { console.error(e); process.exit(1) })



