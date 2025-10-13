'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  TrendingUp, 
  Users, 
  Shield, 
  Award, 
  Activity,
  Search,
  Filter,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { useGetReputation, useGetActiveAgentsByType } from '@/lib/contracts/hooks'
import { AgentType } from '@/lib/contracts/hooks/useAgentRegistry'
import { useAccount } from 'wagmi'

interface Provider {
  id: string
  address: string
  name: string
  reputation: number
  commits: number
  successRate: number
  totalEarnings: string
  joinDate: string
  category: string
  recentActivity: {
    type: 'commit' | 'reveal' | 'verify' | 'dispute'
    timestamp: string
    score?: number
  }[]
  reputationHistory: {
    date: string
    score: number
  }[]
}

const mockProviders: Provider[] = [
  {
    id: '1',
    address: '0x1234...5678',
    name: 'AlphaPredictor',
    reputation: 950,
    commits: 145,
    successRate: 98.2,
    totalEarnings: '12.5 STT',
    joinDate: '2024-01-15',
    category: 'DeFi',
    recentActivity: [
      { type: 'commit', timestamp: '2m ago', score: 98.5 },
      { type: 'verify', timestamp: '1h ago', score: 97.8 },
      { type: 'commit', timestamp: '3h ago', score: 99.1 },
    ],
    reputationHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      score: 950 - Math.random() * 20
    }))
  },
  {
    id: '2',
    address: '0xabcd...efgh',
    name: 'NLPExpert',
    reputation: 920,
    commits: 98,
    successRate: 96.8,
    totalEarnings: '8.7 STT',
    joinDate: '2024-02-01',
    category: 'NLP',
    recentActivity: [
      { type: 'commit', timestamp: '5m ago', score: 96.2 },
      { type: 'verify', timestamp: '2h ago', score: 97.1 },
      { type: 'commit', timestamp: '6h ago', score: 95.8 },
    ],
    reputationHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      score: 920 - Math.random() * 15
    }))
  },
  {
    id: '3',
    address: '0x9876...5432',
    name: 'TradingBot',
    reputation: 890,
    commits: 67,
    successRate: 94.5,
    totalEarnings: '6.2 STT',
    joinDate: '2024-02-15',
    category: 'Trading',
    recentActivity: [
      { type: 'commit', timestamp: '10m ago', score: 94.1 },
      { type: 'verify', timestamp: '4h ago', score: 95.3 },
      { type: 'dispute', timestamp: '1d ago' },
    ],
    reputationHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      score: 890 - Math.random() * 25
    }))
  }
]

const reputationDistribution = [
  { range: '950-1000', count: 5, color: '#10b981' },
  { range: '900-949', count: 12, color: '#3b82f6' },
  { range: '850-899', count: 18, color: '#f59e0b' },
  { range: '800-849', count: 15, color: '#ef4444' },
  { range: '0-799', count: 8, color: '#6b7280' }
]

const categoryStats = [
  { category: 'DeFi', providers: 25, avgReputation: 920, commits: 450 },
  { category: 'NLP', providers: 18, avgReputation: 890, commits: 320 },
  { category: 'Trading', providers: 15, avgReputation: 870, commits: 280 },
  { category: 'Other', providers: 12, avgReputation: 850, commits: 150 }
]

export default function ReputationPage() {
  const { address } = useAccount()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('reputation')

  // Fetch provider agents
  const providers = useGetActiveAgentsByType(AgentType.Provider)

  // Transform contract data into providers
  const providersData = useMemo(() => {
    if (!providers.agents || providers.isLoading) {
      return []
    }

    return providers.agents.map((agent, index) => ({
      id: agent.id.toString(),
      address: agent.agentAddress,
      name: `Provider #${agent.id}`,
      reputation: 0, // Would need to fetch from ReputationManager
      commits: 0, // Would need to fetch from CommitRegistry
      successRate: 0, // Would need to calculate from verification data
      totalEarnings: '0 STT', // Would need to fetch from EscrowManager
      joinDate: new Date().toISOString().split('T')[0], // Would need to fetch from AgentRegistry
      category: 'DeFi', // Would need to fetch from agent metadata
      recentActivity: [], // Would need to fetch from events
      reputationHistory: [], // Would need to fetch from ReputationManager
      isLoading: false,
    }))
  }, [providers])

  const filteredProviders = useMemo(() => {
    let filtered = providersData

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'reputation':
          return b.reputation - a.reputation
        case 'commits':
          return b.commits - a.commits
        case 'successRate':
          return b.successRate - a.successRate
        case 'earnings':
          return parseFloat(b.totalEarnings) - parseFloat(a.totalEarnings)
        default:
          return 0
      }
    })

    return filtered
  }, [providersData, searchTerm, selectedCategory, sortBy])

  const getReputationColor = (reputation: number) => {
    if (reputation >= 950) return 'text-green-400'
    if (reputation >= 900) return 'text-blue-400'
    if (reputation >= 850) return 'text-yellow-400'
    if (reputation >= 800) return 'text-orange-400'
    return 'text-red-400'
  }

  const getReputationBadge = (reputation: number) => {
    if (reputation >= 950) return <Badge className="bg-green-500/20 text-green-400 border-green-400/30">Elite</Badge>
    if (reputation >= 900) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-400/30">Expert</Badge>
    if (reputation >= 850) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-400/30">Pro</Badge>
    if (reputation >= 800) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-400/30">Rising</Badge>
    return <Badge className="bg-white/20 text-white border-white/30">New</Badge>
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-white">Reputation Graph</h1>
        <p className="text-white/80 text-lg">
          Track provider performance and reputation across the Shadow Protocol
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Providers</CardTitle>
            <Users className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {providers.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                providersData.length
              )}
            </div>
            <p className="text-xs text-white/70">Active agents</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Avg Reputation</CardTitle>
            <Shield className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {providers.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                providersData.length > 0 ? Math.round(providersData.reduce((acc, p) => acc + p.reputation, 0) / providersData.length) : 0
              )}
            </div>
            <p className="text-xs text-white/70">Across all providers</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Commits</CardTitle>
            <Activity className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {providers.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                providersData.reduce((acc, p) => acc + p.commits, 0)
              )}
            </div>
            <p className="text-xs text-white/70">This month</p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {providers.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                providersData.length > 0 ? Math.round(providersData.reduce((acc, p) => acc + p.successRate, 0) / providersData.length) : 0
              )}%
            </div>
            <p className="text-xs text-white/70">Average accuracy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reputation Distribution */}
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Reputation Distribution</CardTitle>
              <CardDescription className="text-white/80">Distribution of provider reputation scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reputationDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                      label={({ range, count }) => `${range}: ${count}`}
                    >
                      {reputationDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Performance */}
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Category Performance</CardTitle>
              <CardDescription className="text-white/80">Average reputation by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgReputation" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider List */}
        <div className="space-y-6">
          {/* Search and Filters */}
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Search className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-white">Search Providers</Label>
                <Input
                  id="search"
                  placeholder="Search by name or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-white">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    <SelectItem value="all" className="text-white">All Categories</SelectItem>
                    <SelectItem value="DeFi" className="text-white">DeFi</SelectItem>
                    <SelectItem value="NLP" className="text-white">NLP</SelectItem>
                    <SelectItem value="Trading" className="text-white">Trading</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort" className="text-white">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    <SelectItem value="reputation" className="text-white">Reputation</SelectItem>
                    <SelectItem value="commits" className="text-white">Commits</SelectItem>
                    <SelectItem value="successRate" className="text-white">Success Rate</SelectItem>
                    <SelectItem value="earnings">Earnings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Top Providers */}
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Top Providers</CardTitle>
              <CardDescription className="text-white/80">Highest reputation providers</CardDescription>
            </CardHeader>
            <CardContent>
              {providers.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProviders.slice(0, 5).map((provider, index) => (
                    <div key={provider.id} className="flex items-center justify-between p-3 rounded-lg border border-white/20 bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="font-bold text-sm text-white">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{provider.name}</p>
                          <p className="text-sm text-white/70">{provider.address}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${getReputationColor(provider.reputation)}`}>
                          {provider.reputation}
                        </div>
                        {getReputationBadge(provider.reputation)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Provider List */}
      <Card className="mt-8 backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white">All Providers</CardTitle>
          <CardDescription className="text-white/80">Complete list of providers with detailed metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {providers.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProviders.map((provider) => (
                <div key={provider.id} className="p-4 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="font-bold text-white">{provider.name[0]}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-white">{provider.name}</h3>
                        <p className="text-white/70">{provider.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getReputationBadge(provider.reputation)}
                          <Badge variant="outline" className="bg-white/20 text-white border-white/30">{provider.category}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getReputationColor(provider.reputation)}`}>
                        {provider.reputation}
                      </div>
                      <p className="text-sm text-white/70">Reputation</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-white/70">Commits</p>
                      <p className="font-semibold text-white">{provider.commits}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70">Success Rate</p>
                      <p className="font-semibold text-green-400">{provider.successRate}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70">Earnings</p>
                      <p className="font-semibold text-white">{provider.totalEarnings}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/70">Joined</p>
                      <p className="font-semibold text-white">{new Date(provider.joinDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Reputation History Chart */}
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={provider.reputationHistory}>
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Recent Activity */}
                  <div className="mt-4">
                    <h4 className="font-medium mb-2 text-white">Recent Activity</h4>
                    <div className="space-y-2">
                      {provider.recentActivity.slice(0, 3).map((activity, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          {activity.type === 'commit' && <Clock className="h-4 w-4 text-blue-400" />}
                          {activity.type === 'verify' && <CheckCircle className="h-4 w-4 text-green-400" />}
                          {activity.type === 'dispute' && <AlertCircle className="h-4 w-4 text-red-400" />}
                          <span className="capitalize text-white">{activity.type}</span>
                          {activity.score && (
                            <Badge variant="outline" className="text-xs bg-white/20 text-white border-white/30">
                              {activity.score}%
                            </Badge>
                          )}
                          <span className="text-white/70">{activity.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
