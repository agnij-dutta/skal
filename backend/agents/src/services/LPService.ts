import { ethers } from 'ethers'
import { BaseService, ServiceConfig } from './BaseService.js'
import { AMM_ENGINE_ABI } from '../../../../lib/contracts/abis/ammEngine.js'

export class LPService extends BaseService {
  private ammEngine: ethers.Contract
  private rebalanceInterval: NodeJS.Timeout | null = null
  private rebalanceIntervalMs: number = 60000 // 1 minute

  constructor(serviceConfig: ServiceConfig) {
    super(serviceConfig)
    this.ammEngine = new ethers.Contract(
      this.config.contractAddresses.ammEngine,
      AMM_ENGINE_ABI,
      this.provider
    )
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('LPService is already running')
      return
    }

    try {
      await this.initializeWallet(this.config.agentKeys.lp)
      this.isRunning = true
      
      this.logActivity('LP service started')
      
      // Start with initial liquidity provision
      await this.provideInitialLiquidity()
      
      // Start rebalancing process
      this.startRebalancing()
      
    } catch (error) {
      this.logError(error as Error, 'Failed to start LP service')
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    
    if (this.rebalanceInterval) {
      clearInterval(this.rebalanceInterval)
      this.rebalanceInterval = null
    }

    this.logActivity('LP service stopped')
  }

  private async provideInitialLiquidity(): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot provide liquidity')
      return
    }

    try {
      this.logActivity('Providing initial liquidity...')
      
      const marketId = this.config.marketConfig.marketId
      const amountA = ethers.parseEther(this.config.marketConfig.lpAmountA)
      const amountB = BigInt(this.config.marketConfig.lpAmountB)
      
      const tx = await (this.ammEngine.connect(this.wallet) as any).addLiquidity(
        BigInt(marketId),
        amountA,
        amountB,
        {
          gasLimit: 500000, // Increased gas limit for AMM operations
          value: amountA // Send ETH as amountA
        }
      )

      this.logActivity(`Liquidity added: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Liquidity confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('liquidityAdded', {
          marketId: BigInt(marketId),
          provider: this.wallet!.address,
          amountA,
          amountB,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, 'Failed to provide initial liquidity')
    }
  }

  private startRebalancing(): void {
    this.logActivity('Starting liquidity rebalancing...')
    
    this.rebalanceInterval = setInterval(async () => {
      await this.rebalanceLiquidity()
    }, this.rebalanceIntervalMs)
  }

  private async rebalanceLiquidity(): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot rebalance')
      return
    }

    try {
      this.logActivity('Checking liquidity rebalancing opportunities...')
      
      const marketId = this.config.marketConfig.marketId
      
      // Get current market state
      const market = await (this.ammEngine as any).getMarket(BigInt(marketId))
      
      if (!market || !market.active) {
        this.logActivity(`Market ${marketId} is not active, skipping rebalance`)
        return
      }
      
      // Simple rebalancing logic - add more liquidity if reserves are low
      const reserveA = market.reserveA
      const reserveB = market.reserveB
      const minReserve = ethers.parseEther('1.0') // 1 ETH minimum
      
      if (reserveA < minReserve || reserveB < minReserve) {
        this.logActivity('Reserves are low, adding more liquidity...')
        await this.addLiquidity(marketId)
      } else {
        this.logActivity('Reserves are adequate, no rebalancing needed')
      }
      
    } catch (error) {
      this.logError(error as Error, 'Failed to rebalance liquidity')
    }
  }

  private async addLiquidity(marketId: number): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot add liquidity')
      return
    }

    try {
      // Add smaller amounts for rebalancing
      const amountA = ethers.parseEther('0.1') // 0.1 ETH
      const amountB = ethers.parseEther('0.1') // 0.1 ETH equivalent
      
      const tx = await (this.ammEngine.connect(this.wallet) as any).addLiquidity(
        BigInt(marketId),
        amountA,
        amountB,
        {
          gasLimit: 500000, // Increased gas limit for AMM operations
          value: amountA // Send ETH as amountA
        }
      )

      this.logActivity(`Rebalancing liquidity added: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Rebalancing confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('liquidityRebalanced', {
          marketId: BigInt(marketId),
          provider: this.wallet!.address,
          amountA,
          amountB,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to add liquidity to market ${marketId}`)
    }
  }

  private async removeLiquidity(marketId: number, lpTokens: bigint): Promise<void> {
    if (!this.wallet) {
      this.logError(new Error('Wallet not initialized'), 'Cannot remove liquidity')
      return
    }

    try {
      this.logActivity(`Removing ${ethers.formatEther(lpTokens)} LP tokens from market ${marketId}`)
      
      const tx = await (this.ammEngine.connect(this.wallet) as any).removeLiquidity(
        BigInt(marketId),
        lpTokens,
        {
          gasLimit: 500000, // Increased gas limit for AMM operations
          value: amountA // Send ETH as amountA
        }
      )

      this.logActivity(`Liquidity removed: ${tx.hash}`)
      
      const receipt = await this.waitForTransaction(tx.hash)
      if (receipt) {
        this.logActivity(`Liquidity removal confirmed in block ${receipt.blockNumber}`)
        this.orchestrator.forwardEvent('liquidityRemoved', {
          marketId: BigInt(marketId),
          provider: this.wallet!.address,
          lpTokens,
          txHash: tx.hash
        })
      }
      
    } catch (error) {
      this.logError(error as Error, `Failed to remove liquidity from market ${marketId}`)
    }
  }
}
