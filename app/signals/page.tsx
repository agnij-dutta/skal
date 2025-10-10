'use client'

import { useState, useEffect } from 'react'
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
  ShoppingCart, 
  Eye, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  TrendingUp,
  Users,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Signal {
  id: string
  taskId: string
  marketId: number
  marketName: string
  provider: string
  providerReputation: number
  description: string
  price: string
  stake: string
  commitTime: string
  status: 'available' | 'locked' | 'revealed' | 'verified' | 'settled'
  verificationScore?: number
  category: string
}

const mockSignals: Signal[] = [
  {
    id: '1',
    taskId: '12345',
    marketId: 1,
    marketName: 'ETH Price Prediction',
    provider: '0x1234...5678',
    providerReputation: 950,
    description: '1-hour ETH price prediction with 98.5% confidence',
    price: '0.05 STT',
    stake: '0.05 STT',
    commitTime: '2 minutes ago',
    status: 'available',
    category: 'DeFi'
  },
  {
    id: '2',
    taskId: '12346',
    marketId: 2,
    marketName: 'DeFi Signals',
    provider: '0xabcd...efgh',
    providerReputation: 920,
    description: 'Yield farming opportunity on Uniswap V3',
    price: '0.08 STT',
    stake: '0.08 STT',
    commitTime: '5 minutes ago',
    status: 'available',
    category: 'DeFi'
  },
  {
    id: '3',
    taskId: '12347',
    marketId: 3,
    marketName: 'NLP Embeddings',
    provider: '0x9876...5432',
    providerReputation: 890,
    description: 'High-quality text embeddings for semantic search',
    price: '0.12 STT',
    stake: '0.12 STT',
    commitTime: '8 minutes ago',
    status: 'available',
    category: 'NLP'
  },
  {
    id: '4',
    taskId: '12348',
    marketId: 1,
    marketName: 'ETH Price Prediction',
    provider: '0x1111...2222',
    providerReputation: 980,
    description: 'Advanced ML model prediction for ETH price',
    price: '0.06 STT',
    stake: '0.06 STT',
    commitTime: '12 minutes ago',
    status: 'verified',
    verificationScore: 97.2,
    category: 'DeFi'
  }
]

export default function SignalsPage() {
  const searchParams = useSearchParams()
  const marketFilter = searchParams.get('market')
  
  const [signals, setSignals] = useState<Signal[]>(mockSignals)
  const [filteredSignals, setFilteredSignals] = useState<Signal[]>(mockSignals)
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [buyAmount, setBuyAmount] = useState('')
  const [isBuying, setIsBuying] = useState(false)
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'available',
    minReputation: '0',
    maxPrice: '1000'
  })

  useEffect(() => {
    let filtered = signals

    // Apply market filter
    if (marketFilter) {
      filtered = filtered.filter(s => s.marketId === parseInt(marketFilter))
    }

    // Apply other filters
    if (filters.category !== 'all') {
      filtered = filtered.filter(s => s.category === filters.category)
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter(s => s.status === filters.status)
    }
    if (filters.minReputation !== '0') {
      filtered = filtered.filter(s => s.providerReputation >= parseInt(filters.minReputation))
    }
    if (filters.maxPrice !== '1000') {
      filtered = filtered.filter(s => parseFloat(s.price) <= parseFloat(filters.maxPrice))
    }

    setFilteredSignals(filtered)
  }, [signals, filters, marketFilter])

  const handleBuySignal = async (signal: Signal) => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsBuying(true)
    setSelectedSignal(signal)

    try {
      // Simulate buying process
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Update signal status
      setSignals(prev => prev.map(s => 
        s.id === signal.id ? { ...s, status: 'locked' as const } : s
      ))
      
      toast.success(`Successfully bought signal for ${buyAmount} STT`)
      setBuyAmount('')
      setSelectedSignal(null)
    } catch (error) {
      toast.error('Failed to buy signal')
    } finally {
      setIsBuying(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      available: 'default',
      locked: 'secondary',
      revealed: 'outline',
      verified: 'default',
      settled: 'secondary'
    } as const

    const colors = {
      available: 'text-green-600',
      locked: 'text-blue-600',
      revealed: 'text-orange-600',
      verified: 'text-green-600',
      settled: 'text-gray-600'
    }

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        <span className={colors[status as keyof typeof colors] || 'text-gray-600'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </Badge>
    )
  }

  const getReputationColor = (reputation: number) => {
    if (reputation >= 950) return 'text-green-600'
    if (reputation >= 900) return 'text-blue-600'
    if (reputation >= 800) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-white">Buy Signals</h1>
        <p className="text-white/80 text-lg">
          Purchase verified AI intelligence from providers
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={filters.category} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
                >
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
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minReputation">Min Reputation</Label>
                <Input
                  id="minReputation"
                  type="number"
                  min="0"
                  max="1000"
                  value={filters.minReputation}
                  onChange={(e) => setFilters(prev => ({ ...prev, minReputation: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPrice">Max Price (STT)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Signals List */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="available" className="space-y-6">
            <TabsList>
              <TabsTrigger value="available">Available ({filteredSignals.filter(s => s.status === 'available').length})</TabsTrigger>
              <TabsTrigger value="verified">Verified ({filteredSignals.filter(s => s.status === 'verified').length})</TabsTrigger>
              <TabsTrigger value="my-signals">My Signals (0)</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-4">
              {filteredSignals.filter(s => s.status === 'available').map((signal) => (
                <Card key={signal.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{signal.marketName}</h3>
                          {getStatusBadge(signal.status)}
                        </div>
                        <p className="text-muted-foreground mb-2">{signal.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Task #{signal.taskId}</span>
                          <span>•</span>
                          <span>{signal.commitTime}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{signal.price}</div>
                        <div className="text-sm text-muted-foreground">per signal</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Provider</p>
                        <p className="font-medium">{signal.provider}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Reputation</p>
                        <p className={`font-medium ${getReputationColor(signal.providerReputation)}`}>
                          {signal.providerReputation}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Stake</p>
                        <p className="font-medium">{signal.stake}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Category</p>
                        <p className="font-medium">{signal.category}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => setSelectedSignal(signal)}
                        className="flex-1"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Buy Signal
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/markets/${signal.marketId}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Market
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredSignals.filter(s => s.status === 'available').length === 0 && (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No available signals found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="verified" className="space-y-4">
              {filteredSignals.filter(s => s.status === 'verified').map((signal) => (
                <Card key={signal.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{signal.marketName}</h3>
                          {getStatusBadge(signal.status)}
                        </div>
                        <p className="text-muted-foreground mb-2">{signal.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Task #{signal.taskId}</span>
                          <span>•</span>
                          <span>{signal.commitTime}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">{signal.price}</div>
                        <div className="text-sm text-muted-foreground">verified</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Provider</p>
                        <p className="font-medium">{signal.provider}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Reputation</p>
                        <p className={`font-medium ${getReputationColor(signal.providerReputation)}`}>
                          {signal.providerReputation}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Verification Score</p>
                        <p className="font-medium text-green-600">{signal.verificationScore}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Category</p>
                        <p className="font-medium">{signal.category}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1">
                        <Eye className="h-4 w-4 mr-2" />
                        View Results
                      </Button>
                      <Button variant="outline">
                        <Shield className="h-4 w-4 mr-2" />
                        Verify Again
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="my-signals" className="space-y-4">
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You haven't purchased any signals yet</p>
                <Button className="mt-4" asChild>
                  <Link href="/signals">Browse Signals</Link>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Buy Modal */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Buy Signal</CardTitle>
              <CardDescription>
                Purchase {selectedSignal.marketName} from {selectedSignal.provider}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (STT)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder={selectedSignal.price}
                />
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Signal Price:</span>
                  <span>{selectedSignal.price}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gas Fee:</span>
                  <span>~0.001 STT</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{(parseFloat(buyAmount || selectedSignal.price) + 0.001).toFixed(3)} STT</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedSignal(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => handleBuySignal(selectedSignal)}
                  disabled={isBuying}
                >
                  {isBuying ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Buying...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Buy Signal
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
