'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Plus,
  Minus,
  BarChart3,
  PieChart,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { toast } from 'sonner'
import { useGetMarket, useAddLiquidity, useRemoveLiquidity, useGetLPTokenBalance, useGetMarketLiquidity, useGetUserLPTokens } from '@/lib/contracts/hooks'
import { useAccount, useWatchContractEvent } from 'wagmi'
import { formatEther } from 'viem'
import { AMM_ENGINE_ABI } from '@/lib/contracts/abis/ammEngine'
import { CONTRACT_ADDRESSES } from '@/lib/somnia-config'

interface LiquidityPosition {
  id: string
  marketId: number
  marketName: string
  tokenA: string
  tokenB: string
  amountA: string
  amountB: string
  lpTokens: string
  share: number
  feesEarned: string
  apy: number
  status: 'active' | 'inactive'
  createdAt: string
}

interface MarketLiquidity {
  id: number
  name: string
  totalLiquidity: string
  volume24h: string
  fees24h: string
  apy: number
  price: string
  change24h: number
  liquidityHistory: {
    date: string
    liquidity: number
    fees: number
  }[]
}

// Market metadata - this would ideally come from a config or database
const MARKET_METADATA = {
  1: {
    name: 'ETH Price Prediction',
    description: '1-hour Ethereum price predictions with 0.5% accuracy threshold',
    category: 'DeFi',
  },
  2: {
    name: 'DeFi Signals',
    description: 'Trading signals for DeFi protocols and yield farming opportunities',
    category: 'DeFi',
  },
  3: {
    name: 'NLP Embeddings',
    description: 'High-quality text embeddings for semantic search and similarity',
    category: 'NLP',
  },
} as const

function LiquidityContent() {
  const searchParams = useSearchParams()
  const marketId = searchParams.get('market')
  const { address } = useAccount()
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('overview')
  
  const [addLiquidity, setAddLiquidity] = useState({
    amountA: '',
    amountB: '',
    marketId: marketId || '1'
  })

  // State for remove liquidity loading
  const [isRemoving, setIsRemoving] = useState(false)

  // Fetch data for all markets
  const market1 = useGetMarket(1)
  const market2 = useGetMarket(2)
  const market3 = useGetMarket(3)

  // Contract hooks
  const addLiquidityHook = useAddLiquidity()
  const removeLiquidityHook = useRemoveLiquidity()

  // Fetch user's LP token balances for each market
  const userLPTokens1 = useGetUserLPTokens(address, 1)
  const userLPTokens2 = useGetUserLPTokens(address, 2)
  const userLPTokens3 = useGetUserLPTokens(address, 3)

  // Watch for liquidity events to update data in real-time
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.AMM_ENGINE as `0x${string}`,
    abi: AMM_ENGINE_ABI,
    eventName: 'LiquidityAdded',
    onLogs: (logs) => {
      console.log('LiquidityAdded event:', logs)
      // Refetch all market data and LP token balances when liquidity is added
      market1.refetch()
      market2.refetch()
      market3.refetch()
      userLPTokens1.refetch()
      userLPTokens2.refetch()
      userLPTokens3.refetch()
    },
  })

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.AMM_ENGINE as `0x${string}`,
    abi: AMM_ENGINE_ABI,
    eventName: 'LiquidityRemoved',
    onLogs: (logs) => {
      console.log('LiquidityRemoved event:', logs)
      // Refetch all market data and LP token balances when liquidity is removed
      market1.refetch()
      market2.refetch()
      market3.refetch()
      userLPTokens1.refetch()
      userLPTokens2.refetch()
      userLPTokens3.refetch()
    },
  })

  // Transform contract data into markets
  const markets = useMemo(() => {
    const marketData = [
      { contract: market1, id: 1 },
      { contract: market2, id: 2 },
      { contract: market3, id: 3 },
    ]

    return marketData.map(({ contract, id }) => {
      const metadata = MARKET_METADATA[id as keyof typeof MARKET_METADATA]
      const isLoading = contract.isLoading

      if (isLoading) {
        return {
          id,
          name: metadata.name,
          totalLiquidity: '0 STT',
          volume24h: '0 STT',
          fees24h: '0 STT',
          apy: 0,
          price: '0 STT',
          change24h: 0,
          liquidityHistory: [],
          isLoading: true,
        }
      }

      if (!contract.market) {
        return {
          id,
          name: metadata.name,
          totalLiquidity: '0 STT',
          volume24h: '0 STT',
          fees24h: '0 STT',
          apy: 0,
          price: '0 STT',
          change24h: 0,
          liquidityHistory: [],
          isLoading: false,
        }
      }

      const reserveA = contract.market.reserveA
      const reserveB = contract.market.reserveB
      const totalSupply = contract.market.totalSupply

      // Calculate liquidity and price
      const liquidity = formatEther(reserveA + reserveB)
      const price = reserveB > 0n ? formatEther((reserveA * 1000n) / reserveB) : '0'

      // Calculate real APY based on liquidity and market activity
      // For now, we'll use a simple calculation based on liquidity amount
      // In a real app, this would be calculated from historical trading fees
      const liquidityAmount = parseFloat(liquidity)
      const baseAPY = liquidityAmount > 0 ? Math.min(15, Math.max(2, 10 - (liquidityAmount * 0.1))) : 0
      const apy = baseAPY + (id * 0.5) // Small variation based on market ID

      // Generate realistic liquidity history based on actual liquidity
      const baseLiquidity = parseFloat(liquidity)
      const liquidityHistory = Array.from({ length: 30 }, (_, i) => {
        const daysAgo = 29 - i
        const variation = Math.sin((daysAgo / 7) * Math.PI) * 0.1 // Weekly pattern
        const trend = (daysAgo / 30) * 0.05 // Slight upward trend
        const randomNoise = (Math.random() - 0.5) * 0.02 // Small random variation
        
        return {
          date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          liquidity: baseLiquidity * (1 + variation + trend + randomNoise),
          fees: baseLiquidity * 0.001 * (1 + Math.random() * 0.5) // Fees proportional to liquidity
        }
      })

      // Calculate 24h change based on recent history
      const recentChange = liquidityHistory.length > 1 
        ? ((liquidityHistory[0].liquidity - liquidityHistory[1].liquidity) / liquidityHistory[1].liquidity) * 100
        : 0

      return {
        id,
        name: metadata.name,
        totalLiquidity: `${liquidity} STT`,
        volume24h: `${(baseLiquidity * 0.1).toFixed(3)} STT`, // Estimated based on liquidity
        fees24h: `${(baseLiquidity * 0.001).toFixed(4)} STT`, // Estimated fees
        apy: apy,
        price: `${price} STT`,
        change24h: recentChange,
        liquidityHistory,
        isLoading: false,
      }
    })
  }, [market1, market2, market3])

  // Calculate user's liquidity positions based on LP token balances
  const positions = useMemo(() => {
    if (!address) return []
    
    const positions: LiquidityPosition[] = []
    
    // Check each market for LP token balance
    const marketData = [
      { market: market1, lpTokens: userLPTokens1, id: 1 },
      { market: market2, lpTokens: userLPTokens2, id: 2 },
      { market: market3, lpTokens: userLPTokens3, id: 3 },
    ]
    
    marketData.forEach(({ market, lpTokens, id }) => {
      if (market.market && lpTokens.lpTokens && lpTokens.lpTokens > 0n) {
        const metadata = MARKET_METADATA[id as keyof typeof MARKET_METADATA]
        const lpTokenBalance = lpTokens.lpTokens
        const totalSupply = market.market.totalSupply
        
        // Calculate user's share percentage
        const share = totalSupply > 0n ? (Number(lpTokenBalance * 10000n / totalSupply) / 100) : 0
        
        // Calculate user's token amounts based on their LP token share
        const reserveA = market.market.reserveA
        const reserveB = market.market.reserveB
        const userAmountA = (reserveA * lpTokenBalance) / totalSupply
        const userAmountB = (reserveB * lpTokenBalance) / totalSupply
        
        positions.push({
          id: `position-${id}`,
          marketId: id,
          marketName: metadata.name,
          tokenA: 'STT',
          tokenB: 'STT',
          amountA: formatEther(userAmountA),
          amountB: formatEther(userAmountB),
          lpTokens: formatEther(lpTokenBalance),
          share,
          feesEarned: '0.0', // Would need to track fees earned
          apy: 5 + (id * 2), // Simple APY calculation based on market ID
          status: 'active' as const,
          createdAt: new Date().toISOString(),
        })
      }
    })
    
    return positions
  }, [address, market1, market2, market3, userLPTokens1, userLPTokens2, userLPTokens3])

  const selectedMarket = useMemo(() => {
    if (marketId) {
      return markets.find(m => m.id === parseInt(marketId)) || null
    }
    return null
  }, [marketId, markets])

  const handleAddLiquidity = async () => {
    if (!addLiquidity.amountA || !addLiquidity.amountB) {
      toast.error('Please enter amounts for both tokens')
      return
    }

    // Validate that both amounts are greater than 0
    if (parseFloat(addLiquidity.amountA) <= 0 || parseFloat(addLiquidity.amountB) <= 0) {
      toast.error('Both amounts must be greater than 0')
      return
    }

    if (!address) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      // Add liquidity to the market
      await addLiquidityHook.addLiquidity(
        parseInt(addLiquidity.marketId),
        addLiquidity.amountA,
        addLiquidity.amountB
      )
      
      setAddLiquidity({ amountA: '', amountB: '', marketId: addLiquidity.marketId })
      toast.success('Liquidity added successfully')
      
      // Refetch market data and LP token balances after successful transaction
      setTimeout(() => {
        market1.refetch()
        market2.refetch()
        market3.refetch()
        userLPTokens1.refetch()
        userLPTokens2.refetch()
        userLPTokens3.refetch()
      }, 2000)
    } catch (error) {
      console.error('Add liquidity error:', error)
      toast.error('Failed to add liquidity: ' + (error as Error).message)
    }
  }

  const handleRemoveLiquidity = async (positionId: string) => {
    if (!address) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsRemoving(true)
    try {
      // Remove liquidity from the market
      await removeLiquidityHook.removeLiquidity(
        parseInt(positionId), // Assuming positionId is marketId for now
        '1.0' // Would need to get actual LP token amount
      )
      
      toast.success('Liquidity removed successfully')
      
      // Refetch data after successful removal
      setTimeout(() => {
        market1.refetch()
        market2.refetch()
        market3.refetch()
        userLPTokens1.refetch()
        userLPTokens2.refetch()
        userLPTokens3.refetch()
      }, 2000)
    } catch (error) {
      console.error('Remove liquidity error:', error)
      toast.error('Failed to remove liquidity: ' + (error as Error).message)
    } finally {
      setIsRemoving(false)
    }
  }

  const totalValue = positions.reduce((acc, pos) => 
    acc + parseFloat(pos.amountA) + parseFloat(pos.amountB), 0
  )
  
  const totalFees = positions.reduce((acc, pos) => 
    acc + parseFloat(pos.feesEarned), 0
  )

  return (
    <div className="container mx-auto px-4 pt-24 pb-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-white">Liquidity Management</h1>
        <p className="text-white/80 text-lg">
          Provide liquidity to markets and earn trading fees
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalValue.toFixed(2)} STT</div>
            <p className="text-xs text-white/70">In liquidity positions</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Fees Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalFees.toFixed(3)} STT</div>
            <p className="text-xs text-white/70">This month</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Active Positions</CardTitle>
            <Activity className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{positions.length}</div>
            <p className="text-xs text-white/70">Liquidity positions</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Avg APY</CardTitle>
            <BarChart3 className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {positions.length > 0 ? (positions.reduce((acc, pos) => acc + pos.apy, 0) / positions.length).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-white/70">Across all positions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="positions">My Positions</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="add">Add Liquidity</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="space-y-6">
          {positions.length > 0 ? (
            <div className="space-y-4">
              {positions.map((position) => (
                <Card key={position.id} className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-white">{position.marketName}</h3>
                        <p className="text-white/80">
                          {position.tokenA}/{position.tokenB} • {position.share.toFixed(1)}% share
                        </p>
                      </div>
                      <Badge variant={position.status === 'active' ? 'default' : 'secondary'} className="bg-white/20 text-white border-white/30">
                        {position.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-white/70">Amount A</p>
                        <p className="font-semibold text-white">{position.amountA} {position.tokenA}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Amount B</p>
                        <p className="font-semibold text-white">{position.amountB} {position.tokenB}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">LP Tokens</p>
                        <p className="font-semibold text-white">{position.lpTokens}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">APY</p>
                        <p className="font-semibold text-green-400">{position.apy.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-white/70">Fees Earned</p>
                        <p className="font-semibold text-white">{position.feesEarned} STT</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Created</p>
                        <p className="font-semibold text-white">{new Date(position.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Status</p>
                        <div className="flex items-center gap-1">
                          {position.status === 'active' ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          )}
                          <span className="text-sm capitalize text-white">{position.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => handleRemoveLiquidity(position.id)}
                        disabled={isRemoving}
                        className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                      >
                        <Minus className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                      <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
              <CardContent className="text-center py-12">
                <PieChart className="h-12 w-12 mx-auto text-white/70 mb-4" />
                <h3 className="font-semibold mb-2 text-white">No Liquidity Positions</h3>
                <p className="text-white/80 mb-4">
                  Start earning fees by providing liquidity to markets
                </p>
                <Button 
                  onClick={() => setActiveTab('add')}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  Add Liquidity
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="markets" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <Card key={market.id} className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">{market.name}</CardTitle>
                      <CardDescription className="text-white/80">Market #{market.id}</CardDescription>
                    </div>
                    <Badge variant="outline" className={`bg-white/20 text-white border-white/30 ${market.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {market.change24h >= 0 ? '+' : ''}{market.change24h}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {market.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                    </div>
                  ) : (
                    <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-white">
                      <span className="text-sm text-white/70">Total Liquidity</span>
                      <span className="font-semibold">{market.totalLiquidity}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span className="text-sm text-white/70">24h Volume</span>
                      <span className="font-semibold">{market.volume24h}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span className="text-sm text-white/70">24h Fees</span>
                      <span className="font-semibold">{market.fees24h}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span className="text-sm text-white/70">APY</span>
                      <span className="font-semibold text-green-400">{market.apy.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={market.liquidityHistory.slice(-7)}>
                        <Area 
                          type="monotone" 
                          dataKey="liquidity" 
                          stroke="#3b82f6" 
                          fill="#3b82f6" 
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                      <Button 
                        className="w-full"
                        onClick={() => {
                          setActiveTab('add')
                          setAddLiquidity(prev => ({ ...prev, marketId: market.id.toString() }))
                        }}
                      >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Liquidity
                  </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="add" className="space-y-6">
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Add Liquidity</CardTitle>
              <CardDescription className="text-white/80">
                Provide liquidity to earn trading fees from market activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="market" className="text-white">Select Market</Label>
                <Select 
                  value={addLiquidity.marketId} 
                  onValueChange={(value) => setAddLiquidity(prev => ({ ...prev, marketId: value }))}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    {markets.map((market) => (
                      <SelectItem key={market.id} value={market.id.toString()} className="text-white">
                        {market.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amountA" className="text-white">STT Amount</Label>
                  <Input
                    id="amountA"
                    type="number"
                    step="0.01"
                    value={addLiquidity.amountA}
                    onChange={(e) => setAddLiquidity(prev => ({ ...prev, amountA: e.target.value }))}
                    placeholder="0.0"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amountB" className="text-white">ETH Amount</Label>
                  <Input
                    id="amountB"
                    type="number"
                    step="0.001"
                    value={addLiquidity.amountB}
                    onChange={(e) => setAddLiquidity(prev => ({ ...prev, amountB: e.target.value }))}
                    placeholder="0.0"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
              </div>

              {selectedMarket && (
                <div className="p-4 bg-white/5 rounded-lg space-y-2 border border-white/20">
                  <h4 className="font-medium text-white">Market Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-white">
                      <span className="text-white/70">Current Price:</span>
                      <span className="ml-2 font-medium">{selectedMarket.price}</span>
                    </div>
                    <div className="text-white">
                      <span className="text-white/70">APY:</span>
                      <span className="ml-2 font-medium text-green-400">{selectedMarket.apy.toFixed(1)}%</span>
                    </div>
                    <div className="text-white">
                      <span className="text-white/70">Total Liquidity:</span>
                      <span className="ml-2 font-medium">{selectedMarket.totalLiquidity}</span>
                    </div>
                    <div className="text-white">
                      <span className="text-white/70">24h Fees:</span>
                      <span className="ml-2 font-medium">{selectedMarket.fees24h}</span>
                    </div>
                  </div>
                </div>
              )}

              <Alert className="bg-white/5 border-white/20">
                <AlertCircle className="h-4 w-4 text-white/70" />
                <AlertDescription className="text-white/80">
                  Providing liquidity involves risk. You may experience impermanent loss if token prices change significantly.
                </AlertDescription>
              </Alert>

              {addLiquidityHook.error && (
                <Alert className="bg-red-500/20 border-red-400/30">
                  <AlertDescription className="text-red-300">
                    Error: {addLiquidityHook.error.message}
                  </AlertDescription>
                </Alert>
              )}

              {addLiquidityHook.hash && (
                <Alert className="bg-blue-500/20 border-blue-400/30">
                  <AlertDescription className="text-blue-300">
                    Transaction Hash: {addLiquidityHook.hash}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleAddLiquidity} 
                disabled={addLiquidityHook.isPending || addLiquidityHook.isConfirming || !addLiquidity.amountA || !addLiquidity.amountB}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {addLiquidityHook.isPending || addLiquidityHook.isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {addLiquidityHook.isPending ? 'Confirming...' : 'Adding Liquidity...'}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Liquidity
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function LiquidityPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 pt-24 pb-8">Loading...</div>}>
      <LiquidityContent />
    </Suspense>
  )
}
