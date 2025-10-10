'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  Users, 
  Activity, 
  DollarSign, 
  Clock, 
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Eye
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import Link from 'next/link'

interface MarketData {
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
  bondingCurve: {
    x: number
    y: number
    price: number
  }[]
  recentActivity: {
    type: 'commit' | 'reveal' | 'buy' | 'verify'
    timestamp: string
    user: string
    amount?: string
  }[]
  topProviders: {
    address: string
    reputation: number
    commits: number
    successRate: number
  }[]
}

const mockMarketData: Record<number, MarketData> = {
  1: {
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
    status: 'active',
    bondingCurve: Array.from({ length: 20 }, (_, i) => ({
      x: i * 5,
      y: 100 - (i * 4),
      price: 0.05 + (i * 0.002)
    })),
    recentActivity: [
      { type: 'commit', timestamp: '2m ago', user: '0x1234...5678', amount: '0.05 STT' },
      { type: 'buy', timestamp: '5m ago', user: '0xabcd...efgh', amount: '0.08 STT' },
      { type: 'reveal', timestamp: '8m ago', user: '0x1234...5678' },
      { type: 'verify', timestamp: '10m ago', user: 'Verifier #1' },
      { type: 'commit', timestamp: '15m ago', user: '0x9876...5432', amount: '0.05 STT' },
    ],
    topProviders: [
      { address: '0x1234...5678', reputation: 950, commits: 45, successRate: 98.2 },
      { address: '0xabcd...efgh', reputation: 920, commits: 32, successRate: 96.8 },
      { address: '0x9876...5432', reputation: 890, commits: 28, successRate: 94.5 },
    ]
  }
}

export default function MarketDetailPage() {
  const params = useParams()
  const marketId = parseInt(params.id as string)
  const [market, setMarket] = useState<MarketData | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const marketData = mockMarketData[marketId]
    if (marketData) {
      setMarket(marketData)
    }
  }, [marketId])

  if (!market) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Market not found</p>
        </div>
      </div>
    )
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'commit': return <Clock className="h-4 w-4 text-blue-500" />
      case 'reveal': return <Eye className="h-4 w-4 text-green-500" />
      case 'buy': return <DollarSign className="h-4 w-4 text-purple-500" />
      case 'verify': return <Shield className="h-4 w-4 text-orange-500" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-white">{market.name}</h1>
            <p className="text-white/80 text-lg">{market.description}</p>
          </div>
          <Badge variant={market.status === 'active' ? 'default' : 'secondary'} className="bg-white/20 text-white border-white/30">
            {market.status}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-white/70">
          <span>Category: {market.category}</span>
          <span>•</span>
          <span>Market ID: #{market.id}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{market.price}</div>
            <div className={`flex items-center text-xs ${market.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {market.change24h >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {market.change24h >= 0 ? '+' : ''}{market.change24h}%
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liquidity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{market.liquidity}</div>
            <p className="text-xs text-muted-foreground">Available for trading</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{market.volume24h}</div>
            <p className="text-xs text-muted-foreground">Trading activity</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{market.providers}</div>
            <p className="text-xs text-muted-foreground">Active agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bonding-curve">Bonding Curve</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Interact with this market</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" asChild>
                  <Link href={`/signals?market=${market.id}`}>
                    Buy Signal
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/commit?market=${market.id}`}>
                    Commit Output
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/liquidity?market=${market.id}`}>
                    Provide Liquidity
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Market Info */}
            <Card>
              <CardHeader>
                <CardTitle>Market Information</CardTitle>
                <CardDescription>Key details about this market</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Commits</span>
                    <span className="font-medium">{market.commits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-medium">96.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Verification Time</span>
                    <span className="font-medium">2.3s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Dispute Rate</span>
                    <span className="font-medium">1.2%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bonding-curve" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bonding Curve</CardTitle>
              <CardDescription>Price discovery mechanism for this market</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={market.bondingCurve}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${value} STT`, 
                        name === 'price' ? 'Price' : 'Supply'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest transactions and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {market.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg border">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{activity.type}</span>
                        {activity.amount && (
                          <Badge variant="outline">{activity.amount}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        by {activity.user} • {activity.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Providers</CardTitle>
              <CardDescription>Highest reputation providers in this market</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {market.topProviders.map((provider, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{provider.address}</p>
                        <p className="text-sm text-muted-foreground">
                          {provider.commits} commits • {provider.successRate}% success rate
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-yellow-500" />
                        <span className="font-bold">{provider.reputation}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Reputation</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
