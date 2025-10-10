'use client'

import { useState, useEffect, Suspense } from 'react'
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
  AlertCircle
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { toast } from 'sonner'

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

const mockPositions: LiquidityPosition[] = [
  {
    id: '1',
    marketId: 1,
    marketName: 'ETH Price Prediction',
    tokenA: 'STT',
    tokenB: 'ETH',
    amountA: '10.0',
    amountB: '0.5',
    lpTokens: '2.236',
    share: 15.2,
    feesEarned: '0.45',
    apy: 12.5,
    status: 'active',
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    marketId: 2,
    marketName: 'DeFi Signals',
    tokenA: 'STT',
    tokenB: 'USDC',
    amountA: '5.0',
    amountB: '5.0',
    lpTokens: '5.0',
    share: 8.7,
    feesEarned: '0.23',
    apy: 8.3,
    status: 'active',
    createdAt: '2024-02-01'
  }
]

const mockMarkets: MarketLiquidity[] = [
  {
    id: 1,
    name: 'ETH Price Prediction',
    totalLiquidity: '65.8 STT',
    volume24h: '12.3 STT',
    fees24h: '0.37 STT',
    apy: 12.5,
    price: '0.05 STT',
    change24h: 5.2,
    liquidityHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      liquidity: 65.8 + Math.random() * 10 - 5,
      fees: 0.37 + Math.random() * 0.1 - 0.05
    }))
  },
  {
    id: 2,
    name: 'DeFi Signals',
    totalLiquidity: '42.1 STT',
    volume24h: '8.7 STT',
    fees24h: '0.26 STT',
    apy: 8.3,
    price: '0.08 STT',
    change24h: -2.1,
    liquidityHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      liquidity: 42.1 + Math.random() * 8 - 4,
      fees: 0.26 + Math.random() * 0.08 - 0.04
    }))
  },
  {
    id: 3,
    name: 'NLP Embeddings',
    totalLiquidity: '28.9 STT',
    volume24h: '15.2 STT',
    fees24h: '0.46 STT',
    apy: 15.8,
    price: '0.12 STT',
    change24h: 8.7,
    liquidityHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      liquidity: 28.9 + Math.random() * 6 - 3,
      fees: 0.46 + Math.random() * 0.12 - 0.06
    }))
  }
]

function LiquidityContent() {
  const searchParams = useSearchParams()
  const marketId = searchParams.get('market')
  
  const [positions, setPositions] = useState<LiquidityPosition[]>(mockPositions)
  const [markets, setMarkets] = useState<MarketLiquidity[]>(mockMarkets)
  const [selectedMarket, setSelectedMarket] = useState<MarketLiquidity | null>(null)
  const [addLiquidity, setAddLiquidity] = useState({
    amountA: '',
    amountB: '',
    marketId: marketId || '1'
  })
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    if (marketId) {
      const market = markets.find(m => m.id === parseInt(marketId))
      setSelectedMarket(market || null)
    }
  }, [marketId, markets])

  const handleAddLiquidity = async () => {
    if (!addLiquidity.amountA || !addLiquidity.amountB) {
      toast.error('Please enter amounts for both tokens')
      return
    }

    setIsAdding(true)
    
    try {
      // Simulate adding liquidity
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const newPosition: LiquidityPosition = {
        id: Math.random().toString(36).substr(2, 9),
        marketId: parseInt(addLiquidity.marketId),
        marketName: markets.find(m => m.id === parseInt(addLiquidity.marketId))?.name || 'Unknown',
        tokenA: 'STT',
        tokenB: 'ETH',
        amountA: addLiquidity.amountA,
        amountB: addLiquidity.amountB,
        lpTokens: (parseFloat(addLiquidity.amountA) * parseFloat(addLiquidity.amountB)).toFixed(3),
        share: Math.random() * 20,
        feesEarned: '0.00',
        apy: Math.random() * 20,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0]
      }
      
      setPositions(prev => [...prev, newPosition])
      setAddLiquidity({ amountA: '', amountB: '', marketId: addLiquidity.marketId })
      toast.success('Liquidity added successfully')
    } catch (error) {
      toast.error('Failed to add liquidity')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveLiquidity = async (positionId: string) => {
    setIsRemoving(true)
    
    try {
      // Simulate removing liquidity
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setPositions(prev => prev.filter(p => p.id !== positionId))
      toast.success('Liquidity removed successfully')
    } catch (error) {
      toast.error('Failed to remove liquidity')
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

      <Tabs defaultValue="positions" className="space-y-6">
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
                <Button asChild className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                  <a href="#add">Add Liquidity</a>
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

                  <Button className="w-full" asChild>
                    <a href={`/liquidity?market=${market.id}`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Liquidity
                    </a>
                  </Button>
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

              <Button 
                onClick={handleAddLiquidity} 
                disabled={isAdding || !addLiquidity.amountA || !addLiquidity.amountB}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {isAdding ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Adding Liquidity...
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
