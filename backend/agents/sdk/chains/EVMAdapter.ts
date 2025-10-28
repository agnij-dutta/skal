import { ethers } from 'ethers'
import { ChainAdapter, ChainConfig } from './ChainConfig'
import { EventEmitter } from 'events'

/**
 * EVM Adapter for Ethereum-compatible chains (including Somnia)
 */
export class EVMAdapter extends EventEmitter implements ChainAdapter {
  private config: ChainConfig
  private provider: ethers.JsonRpcProvider
  private contracts: Map<string, ethers.Contract> = new Map()
  private initialized: boolean = false

  constructor(config: ChainConfig) {
    super()
    this.config = config
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Initialize contract connections
    // In production, load ABIs from files
    this.initialized = true
    this.emit('initialized')
  }

  async commitSignal(commitHash: string, marketId: number, stake: string): Promise<string> {
    const wallet = this.getWallet()
    const commitRegistry = await this.getContract('commitRegistry')
    
    const stakeWei = ethers.parseEther(stake)
    const tx = await commitRegistry.commitTask(commitHash, marketId, { value: stakeWei })
    
    const receipt = await tx.wait()
    return receipt.hash
  }

  async revealSignal(signalId: number, cid: string, revealedData: string): Promise<boolean> {
    const commitRegistry = await this.getContract('commitRegistry')
    
    const tx = await commitRegistry.revealTask(signalId, cid, revealedData)
    await tx.wait()
    
    return true
  }

  async lockFunds(signalId: number, provider: string, amount: string): Promise<boolean> {
    const escrowManager = await this.getContract('escrowManager')
    
    const amountWei = ethers.parseEther(amount)
    const tx = await escrowManager.lockFunds(signalId, provider, { value: amountWei })
    await tx.wait()
    
    return true
  }

  async buySignal(signalId: number, amountIn: string): Promise<any> {
    const ammEngine = await this.getContract('ammEngine')
    
    // Get market ID (typically 1 for default)
    const marketId = 1
    const amountInWei = ethers.parseEther(amountIn)
    
    const tx = await ammEngine.swapTokens(marketId, amountInWei, { value: amountInWei })
    const receipt = await tx.wait()
    
    return receipt
  }

  async addLiquidity(marketId: number, amountA: string, amountB: string): Promise<any> {
    const ammEngine = await this.getContract('ammEngine')
    
    const amountAWei = ethers.parseEther(amountA)
    const amountBWei = ethers.parseEther(amountB)
    const totalValue = amountAWei + amountBWei
    
    const tx = await ammEngine.addLiquidity(marketId, amountAWei, amountBWei, { value: totalValue })
    const receipt = await tx.wait()
    
    return receipt
  }

  on(eventName: string, callback: (data: any) => void): void {
    super.on(eventName, callback)
    
    // Set up event listeners for contracts
    this.setupEventListeners()
  }

  getConfig(): ChainConfig {
    return this.config
  }

  private getWallet(): ethers.Wallet {
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not set in environment')
    }
    return new ethers.Wallet(privateKey, this.provider)
  }

  private async getContract(contractName: string): Promise<ethers.Contract> {
    if (this.contracts.has(contractName)) {
      return this.contracts.get(contractName)!
    }

    const address = this.config.contracts[contractName as keyof typeof this.config.contracts]
    if (!address) {
      throw new Error(`Contract address not found for ${contractName}`)
    }

    // In production, load ABI from files
    const abi: any[] = [] // Load from ABI files
    const contract = new ethers.Contract(address, abi, this.provider)
    
    this.contracts.set(contractName, contract)
    return contract
  }

  private setupEventListeners(): void {
    // Set up event listeners for commit, reveal, fund lock, etc.
    // This would listen to on-chain events and emit them to subscribers
  }
}
