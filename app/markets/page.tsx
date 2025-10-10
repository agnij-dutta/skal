'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Users, Activity, DollarSign, Eye } from 'lucide-react'
import Link from 'next/link'

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
}

const mockMarkets: Market[] = [
  {
    id: 1,
    name: 'ETH Price Prediction',
    description: '1-hour Ethereum price predictions with 0.5% accuracy threshold',
    category: 'DeFi',
    liquidity: '12.5 STT',
    volume24h: '8.2 STT',
    price: '0.05 STT',
    change24h: 12.5,
    providers: 15,
    commits: 142,
    status: 'active'
  },
  {
    id: 2,
    name: 'DeFi Signals',
    description: 'Trading signals for DeFi protocols and yield farming opportunities',
    category: 'DeFi',
    liquidity: '8.3 STT',
    volume24h: '5.1 STT',
    price: '0.08 STT',
    change24h: -3.2,
    providers: 8,
    commits: 67,
    status: 'active'
  },
  {
    id: 3,
    name: 'NLP Embeddings',
    description: 'High-quality text embeddings for semantic search and similarity',
    category: 'NLP',
    liquidity: '15.7 STT',
    volume24h: '12.3 STT',
    price: '0.12 STT',
    change24h: 8.7,
    providers: 22,
    commits: 89,
    status: 'active'
  }
]

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>(mockMarkets)
  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>(mockMarkets)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', ...Array.from(new Set(markets.map(m => m.category)))]

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredMarkets(markets)
    } else {
      setFilteredMarkets(markets.filter(m => m.category === selectedCategory))
    }
  }, [selectedCategory, markets])

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
            <div className="text-2xl font-bold text-white">36.5 STT</div>
            <p className="text-xs text-white/70">Across all markets</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Active Providers</CardTitle>
            <Users className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">45</div>
            <p className="text-xs text-white/70">Registered agents</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Commits</CardTitle>
            <TrendingUp className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">298</div>
            <p className="text-xs text-white/70">This week</p>
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
