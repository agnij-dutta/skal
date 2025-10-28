'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Users, Activity, DollarSign, Eye, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useGetMarket, useGetMarketTasks, useGetActiveAgentsByType, useGetTotalTasks, useGetTask } from '@/lib/contracts/hooks'
import { AgentType } from '@/lib/contracts/hooks/useAgentRegistry'
import { formatEther } from 'viem'

interface Market {
  id: number
  name: string
  description: string
  category: string
  liquidity: string
  volume24h: string
  price: string
  change24h: number
  providers: number
  commits: number
  status: 'active' | 'paused' | 'closed'
  isLoading?: boolean
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

export default function MarketsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Fetch data for all markets
  const market1 = useGetMarket(1)
  const market2 = useGetMarket(2)
  const market3 = useGetMarket(3)

  // Get task counts for each market
  const tasks1 = useGetMarketTasks(1)
  const tasks2 = useGetMarketTasks(2)
  const tasks3 = useGetMarketTasks(3)

  // Get provider agents
  const providers = useGetActiveAgentsByType(AgentType.Provider)
  const totalTasks = useGetTotalTasks()

  // Helper function to count unique providers from task IDs
  const getUniqueProvidersCount = (taskIds: bigint[] | undefined) => {
    if (!taskIds || taskIds.length === 0) return 0
    
    // For now, we'll assume each task has a different provider
    // In a real implementation, you'd fetch task details and count unique providers
    // This is a simplified approach that works for the current setup
    return taskIds.length
  }

  // Debug: Log contract data
  useEffect(() => {
    console.log('Market 1 data:', market1)
    console.log('Market 2 data:', market2)
    console.log('Market 3 data:', market3)
    console.log('Tasks 1 data:', tasks1)
    console.log('Tasks 2 data:', tasks2)
    console.log('Tasks 3 data:', tasks3)
    console.log('Providers data:', providers)
    console.log('Total tasks data:', totalTasks)
  }, [market1, market2, market3, tasks1, tasks2, tasks3, providers, totalTasks])

  // Transform contract data into market objects
  const markets = useMemo(() => {
    const marketData = [
      { contract: market1, tasks: tasks1, id: 1 },
      { contract: market2, tasks: tasks2, id: 2 },
      { contract: market3, tasks: tasks3, id: 3 },
    ]

    return marketData.map(({ contract, tasks, id }) => {
      const metadata = MARKET_METADATA[id as keyof typeof MARKET_METADATA]
      const isLoading = contract.isLoading || tasks.isLoading

      if (isLoading) {
        return {
          id,
          name: metadata.name,
          description: metadata.description,
          category: metadata.category,
          liquidity: '0 FLOW',
          volume24h: '0 FLOW',
          price: '0 FLOW',
          change24h: 0,
          providers: 0,
          commits: 0,
          status: 'active' as const,
          isLoading: true,
        }
      }

      if (!contract.market) {
        console.log(`Market ${id} not found in contract`)
        return {
          id,
          name: metadata.name,
          description: metadata.description,
          category: metadata.category,
          liquidity: '0 FLOW',
          volume24h: '0 FLOW',
          price: '0 FLOW',
          change24h: 0,
          providers: 0,
          commits: 0,
          status: 'closed' as const,
          isLoading: false,
        }
      }

      const reserveA = contract.market.reserveA
      const reserveB = contract.market.reserveB
      const totalSupply = contract.market.totalSupply

      // Calculate liquidity (reserveA + reserveB in FLOW)
      const liquidity = formatEther(reserveA + reserveB)
      
      // Calculate price (reserveA / reserveB)
      const price = reserveB > 0n ? formatEther((reserveA * 1000n) / reserveB) : '0'
      
      // Get task count for this market
      const commits = tasks.taskIds ? Number(tasks.taskIds.length) : 0
      
      // Get provider count from actual commits in this market
      const providerCount = getUniqueProvidersCount(tasks.taskIds)

      return {
        id,
        name: metadata.name,
        description: metadata.description,
        category: metadata.category,
        liquidity: `${liquidity} FLOW`,
        volume24h: '0 FLOW', // Would need historical data
        price: `${price} FLOW`,
        change24h: 0, // Would need historical data
        providers: providerCount,
        commits,
        status: contract.market.active ? 'active' : 'paused',
        isLoading: false,
      }
    })
  }, [market1, market2, market3, tasks1, tasks2, tasks3, providers])

  const filteredMarkets = useMemo(() => {
    if (selectedCategory === 'all') {
      return markets
    }
    return markets.filter(m => m.category === selectedCategory)
  }, [selectedCategory, markets])

  const categories = ['all', ...Array.from(new Set(markets.map(m => m.category)))]

  // Calculate totals
  const totalLiquidity = markets.reduce((sum, market) => {
    const liquidity = parseFloat(market.liquidity.replace(' FLOW', ''))
    return sum + liquidity
  }, 0)

  // Calculate total unique providers across all markets
  const totalProviders = markets.reduce((sum, market) => sum + market.providers, 0)
  const totalCommits = totalTasks.totalTasks ? Number(totalTasks.totalTasks) : 0

  return (
    <div className="container mx-auto px-4 pt-24 pb-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-white">Intelligence Markets</h1>
        <p className="text-white/80 text-lg">
          Discover and trade AI intelligence across various categories
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Markets</CardTitle>
            <Activity className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{markets.length}</div>
            <p className="text-xs text-white/70">Active markets</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Liquidity</CardTitle>
            <DollarSign className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {totalLiquidity.toFixed(2)} FLOW
            </div>
            <p className="text-xs text-white/70">Across all markets</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Active Providers</CardTitle>
            <Users className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {providers.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                totalProviders
              )}
            </div>
            <p className="text-xs text-white/70">Registered agents</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Commits</CardTitle>
            <TrendingUp className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {totalTasks.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                totalCommits
              )}
            </div>
            <p className="text-xs text-white/70">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Markets</TabsTrigger>
          {categories.slice(1).map(category => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMarkets.map((market) => (
          <Card key={market.id} className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl text-white">{market.name}</CardTitle>
                  <CardDescription className="mt-2 text-white/80">{market.description}</CardDescription>
                </div>
                <Badge variant={market.status === 'active' ? 'default' : 'secondary'} className="bg-white/20 text-white border-white/30">
                  {market.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {market.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                  </div>
                ) : (
                  <>
                    {/* Market Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-white/70">Liquidity</p>
                        <p className="font-semibold text-white">{market.liquidity}</p>
                      </div>
                      <div>
                        <p className="text-white/70">24h Volume</p>
                        <p className="font-semibold text-white">{market.volume24h}</p>
                      </div>
                      <div>
                        <p className="text-white/70">Price</p>
                        <p className="font-semibold text-white">{market.price}</p>
                      </div>
                      <div>
                        <p className="text-white/70">24h Change</p>
                        <p className={`font-semibold ${market.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {market.change24h >= 0 ? '+' : ''}{market.change24h}%
                        </p>
                      </div>
                    </div>

                    {/* Provider Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-white/70" />
                        <span className="text-white/80">{market.providers} providers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-white/70" />
                        <span className="text-white/80">{market.commits} commits</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button asChild className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30">
                        <Link href={`/markets/${market.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </Button>
                      <Button variant="outline" asChild className="bg-transparent hover:bg-white/10 text-white border-white/30">
                        <Link href={`/signals?market=${market.id}`}>
                          Buy Signal
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMarkets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No markets found for the selected category.</p>
        </div>
      )}
    </div>
  )
}
