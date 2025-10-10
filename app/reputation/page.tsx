'use client'

import { useState, useEffect } from 'react'
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
  AlertCircle
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

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
  const [providers, setProviders] = useState<Provider[]>(mockProviders)
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>(mockProviders)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('reputation')

  useEffect(() => {
    let filtered = providers

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

    setFilteredProviders(filtered)
  }, [providers, searchTerm, selectedCategory, sortBy])

  const getReputationColor = (reputation: number) => {
    if (reputation >= 950) return 'text-green-600'
    if (reputation >= 900) return 'text-blue-600'
    if (reputation >= 850) return 'text-yellow-600'
    if (reputation >= 800) return 'text-orange-600'
    return 'text-red-600'
  }

  const getReputationBadge = (reputation: number) => {
    if (reputation >= 950) return <Badge className="bg-green-100 text-green-800">Elite</Badge>
    if (reputation >= 900) return <Badge className="bg-blue-100 text-blue-800">Expert</Badge>
    if (reputation >= 850) return <Badge className="bg-yellow-100 text-yellow-800">Pro</Badge>
    if (reputation >= 800) return <Badge className="bg-orange-100 text-orange-800">Rising</Badge>
    return <Badge className="bg-gray-100 text-gray-800">New</Badge>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Providers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providers.length}</div>
            <p className="text-xs text-muted-foreground">Active agents</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Reputation</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(providers.reduce((acc, p) => acc + p.reputation, 0) / providers.length)}
            </div>
            <p className="text-xs text-muted-foreground">Across all providers</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {providers.reduce((acc, p) => acc + p.commits, 0)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(providers.reduce((acc, p) => acc + p.successRate, 0) / providers.length)}%
            </div>
            <p className="text-xs text-muted-foreground">Average accuracy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reputation Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Reputation Distribution</CardTitle>
              <CardDescription>Distribution of provider reputation scores</CardDescription>
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
          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
              <CardDescription>Average reputation by category</CardDescription>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Providers</Label>
                <Input
                  id="search"
                  placeholder="Search by name or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="DeFi">DeFi</SelectItem>
                    <SelectItem value="NLP">NLP</SelectItem>
                    <SelectItem value="Trading">Trading</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reputation">Reputation</SelectItem>
                    <SelectItem value="commits">Commits</SelectItem>
                    <SelectItem value="successRate">Success Rate</SelectItem>
                    <SelectItem value="earnings">Earnings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Top Providers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Providers</CardTitle>
              <CardDescription>Highest reputation providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredProviders.slice(0, 5).map((provider, index) => (
                  <div key={provider.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-bold text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-sm text-muted-foreground">{provider.address}</p>
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
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Provider List */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>All Providers</CardTitle>
          <CardDescription>Complete list of providers with detailed metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredProviders.map((provider) => (
              <div key={provider.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-bold">{provider.name[0]}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{provider.name}</h3>
                      <p className="text-muted-foreground">{provider.address}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getReputationBadge(provider.reputation)}
                        <Badge variant="outline">{provider.category}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getReputationColor(provider.reputation)}`}>
                      {provider.reputation}
                    </div>
                    <p className="text-sm text-muted-foreground">Reputation</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Commits</p>
                    <p className="font-semibold">{provider.commits}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="font-semibold text-green-600">{provider.successRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Earnings</p>
                    <p className="font-semibold">{provider.totalEarnings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Joined</p>
                    <p className="font-semibold">{new Date(provider.joinDate).toLocaleDateString()}</p>
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
                  <h4 className="font-medium mb-2">Recent Activity</h4>
                  <div className="space-y-2">
                    {provider.recentActivity.slice(0, 3).map((activity, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {activity.type === 'commit' && <Clock className="h-4 w-4 text-blue-500" />}
                        {activity.type === 'verify' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {activity.type === 'dispute' && <AlertCircle className="h-4 w-4 text-red-500" />}
                        <span className="capitalize">{activity.type}</span>
                        {activity.score && (
                          <Badge variant="outline" className="text-xs">
                            {activity.score}%
                          </Badge>
                        )}
                        <span className="text-muted-foreground">{activity.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
