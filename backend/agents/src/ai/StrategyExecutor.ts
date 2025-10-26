import { ethers } from 'ethers'
import { 
  Strategy, 
  ExecutionResult, 
  OptimizedTrades, 
  Trade, 
  PortfolioTarget,
  Position
} from './types.js'
import { RiskManager } from './RiskManager.js'

export interface StrategyExecutorConfig {
  provider: ethers.JsonRpcProvider
  riskManager: RiskManager
  maxSlippage?: number
  gasLimit?: bigint
}

export class StrategyExecutor {
  private provider: ethers.JsonRpcProvider
  private riskManager: RiskManager
  private maxSlippage: number
  private gasLimit: bigint
  private executionHistory: Map<string, ExecutionResult[]> = new Map()

  constructor(config: StrategyExecutorConfig) {
    this.provider = config.provider
    this.riskManager = config.riskManager
    this.maxSlippage = config.maxSlippage || 0.01 // 1% max slippage
    this.gasLimit = config.gasLimit || BigInt(500000)
  }

  /**
   * Execute a trading strategy
   */
  async executeStrategy(strategy: Strategy): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = []

    try {
      for (const action of strategy.actions) {
        const result = await this.executeAction(action)
        results.push(result)

        // If any action fails critically, stop execution
        if (!result.success && action.type === 'trade') {
          console.error(`Critical trade failure: ${result.error}`)
          break
        }
      }

      return results
    } catch (error) {
      console.error('Strategy execution error:', error)
      return [{
        success: false,
        error: `Strategy execution failed: ${error}`
      }]
    }
  }

  /**
   * Optimize trade execution to minimize slippage and gas costs
   */
  async optimizeExecution(trades: Trade[]): Promise<OptimizedTrades> {
    // Group trades by market to batch operations
    const tradesByMarket = new Map<number, Trade[]>()
    
    for (const trade of trades) {
      if (!tradesByMarket.has(trade.marketId)) {
        tradesByMarket.set(trade.marketId, [])
      }
      tradesByMarket.get(trade.marketId)!.push(trade)
    }

    const optimizedTrades: Trade[] = []
    let totalValue = 0n
    let totalSlippage = 0
    let totalGasEstimate = 0n

    // Optimize each market's trades
    for (const [marketId, marketTrades] of tradesByMarket) {
      const optimized = await this.optimizeMarketTrades(marketId, marketTrades)
      optimizedTrades.push(...optimized.trades)
      totalValue += optimized.totalValue
      totalSlippage += optimized.expectedSlippage
      totalGasEstimate += optimized.gasEstimate
    }

    return {
      trades: optimizedTrades,
      totalValue,
      expectedSlippage: totalSlippage / tradesByMarket.size,
      gasEstimate: totalGasEstimate
    }
  }

  /**
   * Handle slippage for a trade
   */
  async handleSlippage(trade: Trade, actualPrice: bigint): Promise<void> {
    const expectedPrice = trade.expectedPrice
    const slippage = Number(actualPrice - expectedPrice) / Number(expectedPrice)

    if (Math.abs(slippage) > this.maxSlippage) {
      console.warn(`High slippage detected: ${(slippage * 100).toFixed(2)}% for trade ${trade.type}`)
      
      // Could implement slippage protection strategies here
      // For now, just log the warning
    }
  }

  /**
   * Rebalance portfolio to target allocation
   */
  async rebalancePortfolio(target: PortfolioTarget): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = []

    try {
      // Get current positions
      const currentPositions = await this.getCurrentPositions()
      const totalValue = target.totalValue

      for (const marketTarget of target.markets) {
        const currentPosition = currentPositions.find(p => p.marketId === marketTarget.marketId)
        const targetValue = BigInt(Math.floor(Number(totalValue) * marketTarget.targetAllocation))
        
        if (currentPosition) {
          const currentValue = currentPosition.value
          const difference = targetValue - currentValue
          
          if (Math.abs(Number(difference)) > Number(totalValue) * target.rebalanceThreshold) {
            const action = difference > 0n ? 'add' : 'remove'
            const amount = difference > 0n ? difference : -difference
            
            const result = await this.executeRebalanceAction(
              marketTarget.marketId,
              action,
              amount
            )
            results.push(result)
          }
        } else if (targetValue > 0n) {
          // New position
          const result = await this.executeRebalanceAction(
            marketTarget.marketId,
            'add',
            targetValue
          )
          results.push(result)
        }
      }

      return results
    } catch (error) {
      console.error('Portfolio rebalancing error:', error)
      return [{
        success: false,
        error: `Rebalancing failed: ${error}`
      }]
    }
  }

  // Private helper methods

  private async executeAction(action: any): Promise<ExecutionResult> {
    try {
      switch (action.type) {
        case 'add':
          return await this.executeAddLiquidity(action.marketId, action.amounts)
        case 'remove':
          return await this.executeRemoveLiquidity(action.marketId, action.lpTokens)
        case 'rebalance':
          return await this.executeRebalance(action.from, action.to, action.amount)
        case 'trade':
          return await this.executeTrade(action)
        default:
          return {
            success: false,
            error: `Unknown action type: ${action.type}`
          }
      }
    } catch (error) {
      return {
        success: false,
        error: `Action execution failed: ${error}`
      }
    }
  }

  private async executeAddLiquidity(marketId: number, amounts: { amountA: bigint; amountB: bigint }): Promise<ExecutionResult> {
    try {
      // This would interact with the AMM contract
      // For now, simulate the execution
      console.log(`Adding liquidity to market ${marketId}: ${ethers.formatEther(amounts.amountA)} + ${ethers.formatEther(amounts.amountB)}`)
      
      return {
        success: true,
        transactionHash: `0x${Math.random().toString(16).substring(2)}`,
        actualAmount: amounts.amountA + amounts.amountB,
        slippage: 0.001,
        gasUsed: BigInt(200000)
      }
    } catch (error) {
      return {
        success: false,
        error: `Add liquidity failed: ${error}`
      }
    }
  }

  private async executeRemoveLiquidity(marketId: number, lpTokens: bigint): Promise<ExecutionResult> {
    try {
      console.log(`Removing liquidity from market ${marketId}: ${ethers.formatEther(lpTokens)} LP tokens`)
      
      return {
        success: true,
        transactionHash: `0x${Math.random().toString(16).substring(2)}`,
        actualAmount: lpTokens,
        slippage: 0.001,
        gasUsed: BigInt(150000)
      }
    } catch (error) {
      return {
        success: false,
        error: `Remove liquidity failed: ${error}`
      }
    }
  }

  private async executeRebalance(fromMarket: number, toMarket: number, amount: bigint): Promise<ExecutionResult> {
    try {
      console.log(`Rebalancing ${ethers.formatEther(amount)} from market ${fromMarket} to market ${toMarket}`)
      
      return {
        success: true,
        transactionHash: `0x${Math.random().toString(16).substring(2)}`,
        actualAmount: amount,
        slippage: 0.002,
        gasUsed: BigInt(300000)
      }
    } catch (error) {
      return {
        success: false,
        error: `Rebalance failed: ${error}`
      }
    }
  }

  private async executeTrade(trade: Trade): Promise<ExecutionResult> {
    try {
      console.log(`Executing ${trade.type} trade on market ${trade.marketId}: ${ethers.formatEther(trade.amount)}`)
      
      return {
        success: true,
        transactionHash: `0x${Math.random().toString(16).substring(2)}`,
        actualAmount: trade.amount,
        slippage: 0.005,
        gasUsed: BigInt(100000)
      }
    } catch (error) {
      return {
        success: false,
        error: `Trade execution failed: ${error}`
      }
    }
  }

  private async executeRebalanceAction(marketId: number, action: string, amount: bigint): Promise<ExecutionResult> {
    try {
      console.log(`${action} ${ethers.formatEther(amount)} for market ${marketId}`)
      
      return {
        success: true,
        transactionHash: `0x${Math.random().toString(16).substring(2)}`,
        actualAmount: amount,
        slippage: 0.001,
        gasUsed: BigInt(150000)
      }
    } catch (error) {
      return {
        success: false,
        error: `Rebalance action failed: ${error}`
      }
    }
  }

  private async optimizeMarketTrades(marketId: number, trades: Trade[]): Promise<OptimizedTrades> {
    // Simple optimization: combine trades of same type
    const buyTrades = trades.filter(t => t.type === 'buy')
    const sellTrades = trades.filter(t => t.type === 'sell')
    
    const optimizedTrades: Trade[] = []
    
    if (buyTrades.length > 0) {
      const totalBuyAmount = buyTrades.reduce((sum, t) => sum + t.amount, 0n)
      optimizedTrades.push({
        type: 'buy',
        marketId,
        amount: totalBuyAmount,
        expectedPrice: buyTrades[0].expectedPrice,
        maxSlippage: Math.min(...buyTrades.map(t => t.maxSlippage))
      })
    }
    
    if (sellTrades.length > 0) {
      const totalSellAmount = sellTrades.reduce((sum, t) => sum + t.amount, 0n)
      optimizedTrades.push({
        type: 'sell',
        marketId,
        amount: totalSellAmount,
        expectedPrice: sellTrades[0].expectedPrice,
        maxSlippage: Math.min(...sellTrades.map(t => t.maxSlippage))
      })
    }

    const totalValue = optimizedTrades.reduce((sum, t) => sum + t.amount, 0n)
    const expectedSlippage = 0.001 // Optimized trades have lower slippage
    const gasEstimate = BigInt(optimizedTrades.length * 100000)

    return {
      trades: optimizedTrades,
      totalValue,
      expectedSlippage,
      gasEstimate
    }
  }

  private async getCurrentPositions(): Promise<Position[]> {
    // This would query the AMM contract for current positions
    // For now, return empty array
    return []
  }
}
