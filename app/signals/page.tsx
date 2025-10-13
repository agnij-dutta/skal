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
  ShoppingCart, 
  Eye, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  TrendingUp,
  Users,
  Filter,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useLockFunds, useGetReputation, useGetActiveAgentsByType } from '@/lib/contracts/hooks'
import { useSignals, useUserSignals, useAvailableSignals, useVerifiedSignals } from '@/lib/contracts/hooks/useSignals'
import { useUserSignalsContext } from '@/lib/contexts/UserSignalsContext'
import { AgentType } from '@/lib/contracts/hooks/useAgentRegistry'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'

interface Signal {
  id: string
  taskId: number
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
  isLoading?: boolean
}

// Market metadata
const MARKET_METADATA = {
  1: {
    name: 'ETH Price Prediction',
    category: 'DeFi',
  },
  2: {
    name: 'DeFi Signals',
    category: 'DeFi',
  },
  3: {
    name: 'NLP Embeddings',
    category: 'NLP',
  },
} as const

function SignalsContent() {
  const searchParams = useSearchParams()
  const marketFilter = searchParams.get('market')
  const { address } = useAccount()
  
  const [activeTab, setActiveTab] = useState<'available' | 'verified' | 'my-signals'>('available')

  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [buyAmount, setBuyAmount] = useState('')
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'available',
    minReputation: '0',
    maxPrice: '1000'
  })

  // Contract hooks
  const lockFunds = useLockFunds()
  const { addPurchasedSignal } = useUserSignalsContext()

  // Get signals data using new hooks
  const { signals: allSignals, isLoading: signalsLoading } = useSignals()
  const { signals: availableSignals } = useAvailableSignals()
  const { signals: verifiedSignals } = useVerifiedSignals()
  
  // Get user's purchased signals from context
  const { purchasedSignals: userSignals } = useUserSignalsContext()

  // Show success toast when transaction is confirmed
  useEffect(() => {
    if (lockFunds.isSuccess && lockFunds.hash) {
      toast.success(`Successfully locked funds! Transaction: ${lockFunds.hash.slice(0, 10)}...`)
    }
  }, [lockFunds.isSuccess, lockFunds.hash])

  // Get signals based on active tab
  const signals = useMemo(() => {
    switch (activeTab) {
      case 'available':
        return availableSignals
      case 'verified':
        return verifiedSignals
      case 'my-signals':
        return userSignals
      default:
        return allSignals
    }
  }, [activeTab, availableSignals, verifiedSignals, userSignals, allSignals])

  const filteredSignals = useMemo(() => {
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

    return filtered
  }, [signals, filters, marketFilter])

  const handleBuySignal = async (signal: Signal) => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (!address) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      // Lock funds for the task
      await lockFunds.lockFunds(signal.taskId, buyAmount)
      
      // Add to user's purchased signals
      addPurchasedSignal({
        id: signal.id,
        taskId: signal.taskId,
        marketId: signal.marketId,
        marketName: signal.marketName,
        provider: signal.provider,
        providerReputation: signal.providerReputation,
        description: signal.description,
        price: signal.price,
        stake: signal.stake,
        commitTime: signal.commitTime,
        status: 'locked',
        category: signal.category,
      })
      
      // Don't show success toast here - wait for transaction confirmation
      // The success will be shown when the transaction is confirmed
      setBuyAmount('')
      setSelectedSignal(null)
    } catch (error) {
      console.error('Buy signal error:', error)
      toast.error('Failed to buy signal: ' + (error as Error).message)
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
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-white">Category</Label>
                <Select 
                  value={filters.category} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
                >
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
                <Label htmlFor="status" className="text-white">Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    <SelectItem value="all" className="text-white">All Status</SelectItem>
                    <SelectItem value="available" className="text-white">Available</SelectItem>
                    <SelectItem value="verified" className="text-white">Verified</SelectItem>
                    <SelectItem value="settled" className="text-white">Settled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minReputation" className="text-white">Min Reputation</Label>
                <Input
                  id="minReputation"
                  type="number"
                  min="0"
                  max="1000"
                  value={filters.minReputation}
                  onChange={(e) => setFilters(prev => ({ ...prev, minReputation: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPrice" className="text-white">Max Price (STT)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Signals List */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="available" className="space-y-6">
            <TabsList>
              <TabsTrigger value="available">Available ({availableSignals.length})</TabsTrigger>
              <TabsTrigger value="verified">Verified ({verifiedSignals.length})</TabsTrigger>
              <TabsTrigger value="my-signals">My Signals ({userSignals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="available" className="space-y-4">
              {availableSignals.map((signal) => (
                <Card key={signal.id} className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300">
                  <CardContent className="p-6">
                    {signal.isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg text-white">{signal.marketName}</h3>
                              {getStatusBadge(signal.status)}
                            </div>
                            <p className="text-white/80 mb-2">{signal.description}</p>
                            <div className="flex items-center gap-4 text-sm text-white/70">
                              <span>Task #{signal.taskId}</span>
                              <span>•</span>
                              <span>{signal.commitTime}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-white">{signal.price}</div>
                            <div className="text-sm text-white/70">per signal</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-white/70">Provider</p>
                            <p className="font-medium text-white">{signal.provider}</p>
                          </div>
                          <div>
                            <p className="text-sm text-white/70">Reputation</p>
                            <p className={`font-medium ${getReputationColor(signal.providerReputation)}`}>
                              {signal.providerReputation}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-white/70">Stake</p>
                            <p className="font-medium text-white">{signal.stake}</p>
                          </div>
                          <div>
                            <p className="text-sm text-white/70">Category</p>
                            <p className="font-medium text-white">{signal.category}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => setSelectedSignal(signal)}
                            disabled={lockFunds.isPending || lockFunds.isConfirming}
                            className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30"
                          >
                            {lockFunds.isPending || lockFunds.isConfirming ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {lockFunds.isPending ? 'Confirming...' : 'Buying...'}
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Buy Signal
                              </>
                            )}
                          </Button>
                          <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30" asChild>
                            <Link href={`/markets/${signal.marketId}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Market
                            </Link>
                          </Button>
                        </div>
                      </>
                    )}
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
              {verifiedSignals.map((signal) => (
                <Card key={signal.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg text-white">{signal.marketName}</h3>
                          {getStatusBadge(signal.status)}
                        </div>
                        <p className="text-white/80 mb-2">{signal.description}</p>
                        <div className="flex items-center gap-4 text-sm text-white/70">
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
                        <p className="text-sm text-white/70">Provider</p>
                        <p className="font-medium text-white">{signal.provider}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Reputation</p>
                        <p className={`font-medium ${getReputationColor(signal.providerReputation)}`}>
                          {signal.providerReputation}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Verification Score</p>
                        <p className="font-medium text-green-600">{signal.verificationScore}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Category</p>
                        <p className="font-medium text-white">{signal.category}</p>
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
              {userSignals.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven&apos;t purchased any signals yet</p>
                  <Button className="mt-4" asChild>
                    <Link href="/signals">Browse Signals</Link>
                  </Button>
                </div>
              ) : (
                userSignals.map((signal) => (
                  <Card key={signal.id} className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white">{signal.marketName}</h3>
                            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-400/30">
                              Purchased
                            </Badge>
                          </div>
                          <p className="text-white/70 text-sm mb-2">{signal.description}</p>
                          <div className="flex items-center gap-4 text-sm text-white/60">
                            <span>Task #{signal.taskId}</span>
                            <span>{signal.commitTime}</span>
                            <span>Provider: {signal.provider}</span>
                            <span>Reputation: {signal.providerReputation}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-white">{signal.price}</div>
                          <div className="text-sm text-white/60">per signal</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Buy Modal */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white">Buy Signal</CardTitle>
              <CardDescription className="text-white/70">
                Purchase {selectedSignal.marketName} from {selectedSignal.provider}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-white/90">Amount (STT)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder={selectedSignal.price}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                />
              </div>

              <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg space-y-2">
                <div className="flex justify-between text-white/80">
                  <span>Signal Price:</span>
                  <span>{selectedSignal.price}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Gas Fee:</span>
                  <span>~0.001 STT</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Total:</span>
                  <span>{(parseFloat(buyAmount || selectedSignal.price) + 0.001).toFixed(3)} STT</span>
                </div>
              </div>

              {lockFunds.error && (
                <Alert className="bg-red-500/20 border-red-400/30">
                  <AlertDescription className="text-red-300">
                    Error: {lockFunds.error.message}
                  </AlertDescription>
                </Alert>
              )}

              {lockFunds.hash && (
                <Alert className="bg-blue-500/20 border-blue-400/30">
                  <AlertDescription className="text-blue-300">
                    Transaction Hash: {lockFunds.hash}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
                  onClick={() => setSelectedSignal(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-yellow-400/90 to-yellow-500/90 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold shadow-lg"
                  onClick={() => handleBuySignal(selectedSignal)}
                  disabled={lockFunds.isPending || lockFunds.isConfirming}
                >
                  {lockFunds.isPending || lockFunds.isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {lockFunds.isPending ? 'Confirming...' : 'Buying...'}
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

export default function SignalsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 pt-24 pb-8">Loading...</div>}>
      <SignalsContent />
    </Suspense>
  )
}
