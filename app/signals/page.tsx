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
  Loader2,
  Lock
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useLockFunds, useGetReputation, useGetActiveAgentsByType, useWatchCommitRegistryEvents, useWatchEscrowManagerEvents, useGetTask } from '@/lib/contracts/hooks'
import { decryptData, fetchFromIPFS, storageClient } from '@/lib/storage-client'
import { useSignals, useUserSignals, useAvailableSignals, useVerifiedSignals } from '@/lib/contracts/hooks/useSignals'
import { useUserSignalsContext } from '@/lib/contexts/UserSignalsContext'
import { AgentType } from '@/lib/contracts/hooks/useAgentRegistry'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import { generateDeterministicKey, generateDeterministicNonce } from '@/lib/crypto-utils'
import { shortenAddress } from '@/lib/utils'

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
  status: string
  verificationScore?: number
  category: string
  isLoading?: boolean
  purchaseTime?: string
  encryptionKey?: string
  nonce?: string
  cid?: string
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
  const { addPurchasedSignal, purchasedSignals, updateSignalStatusByTaskId } = useUserSignalsContext()
  const [viewer, setViewer] = useState<{ open: boolean, taskId?: number, cid?: string, content?: any }>(() => ({ open: false }))
  
  // Reveal modal state
  const [showRevealModal, setShowRevealModal] = useState(false)
  const [revealedData, setRevealedData] = useState<string | null>(null)
  const [decryptionKey, setDecryptionKey] = useState('')
  const [decryptionNonce, setDecryptionNonce] = useState('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [currentViewingSignal, setCurrentViewingSignal] = useState<Signal | null>(null)

  // Get signals data using new hooks
  const { signals: allSignals, isLoading: signalsLoading } = useSignals()
  const { signals: availableSignals } = useAvailableSignals()
  const { signals: verifiedSignals } = useVerifiedSignals()
  
  // Get user's purchased signals from context
  const { purchasedSignals: userSignals } = useUserSignalsContext()

  // Show success toast when transaction is confirmed
  useEffect(() => {
    if (lockFunds.isConfirmed && lockFunds.hash) {
      toast.success(`Successfully locked funds! Transaction: ${lockFunds.hash.slice(0, 10)}...`)
    }
  }, [lockFunds.isConfirmed, lockFunds.hash])

  // Advance purchased signal status when FundsLocked/Revealed/Validated/Settled occur
  useWatchEscrowManagerEvents((ev) => {
    const tid = Number(ev.taskId)
    updateSignalStatusByTaskId(tid, 'revealed') // Move to next actionable step for buyer
    toast.success(`Buyer funds locked for task #${tid}`)
  })
  useWatchCommitRegistryEvents(
    undefined,
    async (ev) => {
      const tid = Number(ev.taskId)
      updateSignalStatusByTaskId(tid, 'revealed')
      // Try to auto-decrypt on reveal
      try {
        // Prefer CID from event if present; otherwise rely on signals list
        // @ts-ignore
        const cid = ev.cid || allSignals.find(s => s.taskId === tid)?.cid
        if (cid) {
          await attemptAutomaticDecryption(tid, String(cid))
        }
      } catch {}
    },
    (ev) => {
      const tid = Number(ev.taskId)
      updateSignalStatusByTaskId(tid, 'verified')
    },
    (ev) => {
      const tid = Number(ev.taskId)
      updateSignalStatusByTaskId(tid, 'settled')
    }
  )

  const openViewerForTask = async (taskId: number) => {
    try {
      // First try to find the task in the signals list
      const taskFromSignals = allSignals.find(s => s.taskId === taskId)
      
      if (taskFromSignals && taskFromSignals.cid) {
        // Try to automatically decrypt using a shared key mechanism
        await attemptAutomaticDecryption(taskId, taskFromSignals.cid)
        return
      }
      
      // If no CID available, show error
      toast.error('Data not yet revealed by provider. Please wait for the provider to reveal their data.')
    } catch (error) {
      console.error('Error opening viewer for task:', error)
      toast.error('Failed to open data viewer. Please try again.')
    }
  }

  const attemptAutomaticDecryption = async (taskId: number, cid: string) => {
    try {
      // Find the task in the signals list to get provider address
      const taskFromSignals = allSignals.find(s => s.taskId === taskId)
      if (!taskFromSignals || !taskFromSignals.provider) {
        throw new Error('Task or provider not found in signals list')
      }

      // Generate deterministic key and nonce based on provider address
      // NOTE: We use taskId = 0 because encryption happens before the actual task ID is known
      // The provider encrypts with tempTaskId = 0, so we must decrypt with the same value
      const tempTaskId = 0
      const key = await generateDeterministicKey(taskFromSignals.provider, tempTaskId)
      const nonce = await generateDeterministicNonce(taskFromSignals.provider, tempTaskId)
      
      console.log('Attempting automatic decryption for task:', taskId, 'with provider:', taskFromSignals.provider)
      console.log('Using tempTaskId:', tempTaskId, '(encryption happens before real task ID is known)')
      console.log('Provider address (full):', taskFromSignals.provider)
      console.log('Generated key:', key.slice(0, 16) + '...')
      console.log('Generated nonce:', nonce.slice(0, 16) + '...')
      
      const res = await decryptData(cid, key, nonce)
      
      if (res.success && res.data) {
        setViewer({ open: true, taskId, cid, content: res.data })
        toast.success('Data automatically decrypted!')
      } else {
        console.error('Decryption failed:', res)
        // If automatic decryption fails, show manual decryption interface
        setViewer({ open: true, taskId, cid })
        toast.info('Automatic decryption failed. Please enter the decryption details manually.')
      }
    } catch (error) {
      console.error('Automatic decryption failed:', error)
      // Show manual decryption interface
      setViewer({ open: true, taskId, cid })
      toast.info('Automatic decryption failed. Please enter the decryption details manually.')
    }
  }

  // Use shared crypto utilities for consistent key generation


  const handleDecrypt = async (cid: string, key: string, nonce: string) => {
    try {
      const res = await decryptData(cid, key, nonce)
      if (!res.success) throw new Error(res.message || 'Decrypt failed')
      setViewer(v => ({ ...v, content: res.data }))
    } catch (e:any) {
      toast.error(e.message || 'Failed to decrypt')
    }
  }

  // Get signals based on active tab
  const signals = useMemo(() => {
    switch (activeTab) {
      case 'available':
        return availableSignals as Signal[]
      case 'verified':
        return verifiedSignals as Signal[]
      case 'my-signals':
        // Convert PurchasedSignal[] to Signal[] by mapping to compatible format
        return userSignals.map(signal => ({
          ...signal,
          purchaseTime: signal.purchaseTime,
          encryptionKey: signal.encryptionKey,
          nonce: signal.nonce,
          cid: signal.cid
        })) as Signal[]
      default:
        return allSignals as Signal[]
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

  const handleViewData = async (signal: Signal) => {
    setCurrentViewingSignal(signal)
    setRevealedData(null)
    setDecryptionKey('')
    setDecryptionNonce('')
    setShowRevealModal(true)

    // Attempt automatic decryption (non-blocking)
    try {
      await openViewerForTask(signal.taskId)
    } catch {}
  }

  const handleDecryptData = async () => {
    if (!currentViewingSignal || !decryptionKey || !decryptionNonce) {
      toast.error('Missing signal data or decryption keys.')
      return
    }

    setIsDecrypting(true)
    try {
      // For now, we'll show a placeholder message since we need the actual CID
      // In a real implementation, you'd fetch the CID from the blockchain
      setRevealedData('This is placeholder revealed data. In a real implementation, this would be decrypted from IPFS using the provided key and nonce.')
      toast.success('Data decrypted successfully!')
    } catch (error) {
      console.error('Decryption error:', error)
      toast.error('Error decrypting data: ' + (error as Error).message)
    } finally {
      setIsDecrypting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      available: 'default',
      locked: 'secondary',
      revealed: 'secondary',
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
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
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
                            <p className="font-medium text-white">{shortenAddress(signal.provider)}</p>
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
                          <Button className="bg-white/10 hover:bg-white/20 text-white border-white/30" asChild>
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
                        <p className="font-medium text-white">{shortenAddress(signal.provider)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Reputation</p>
                        <p className={`font-medium ${getReputationColor(signal.providerReputation)}`}>
                          {signal.providerReputation}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Verification Score</p>
                        <p className="font-medium text-green-600">{(signal as any).verificationScore || 0}%</p>
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
                      <Button>
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
                            {getStatusBadge(signal.status)}
                          </div>
                          <p className="text-white/70 text-sm mb-2">{signal.description}</p>
                          <div className="flex items-center gap-4 text-sm text-white/60">
                            <span>Task #{signal.taskId}</span>
                            <span>{signal.commitTime}</span>
                            <span>Provider: {shortenAddress(signal.provider)}</span>
                            <span>Reputation: {signal.providerReputation}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-white">{signal.price}</div>
                          <div className="text-sm text-white/60">per signal</div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        {signal.status === 'revealed' || signal.status === 'verified' || signal.status === 'settled' ? (
                          <Button 
                            onClick={() => handleViewData(signal)}
                            className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30 font-medium"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Data
                          </Button>
                        ) : signal.status === 'locked' ? (
                          <Button 
                            disabled
                            className="flex-1 bg-white/10 text-white/50 border-white/20"
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Waiting for Reveal
                          </Button>
                        ) : null}
                        
                        <Button className="bg-white/10 hover:bg-white/20 text-white border-white/30" asChild>
                          <Link href={`/markets/${signal.marketId}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Market
                          </Link>
                        </Button>
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

      {/* Data Viewer Modal */}
      {viewer.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white">View Revealed Data</CardTitle>
              <CardDescription className="text-white/70">
                Task #{viewer.taskId} - Decrypt and view the revealed AI output
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {viewer.content ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/20 border border-green-400/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Data Successfully Decrypted</span>
                    </div>
                    <p className="text-sm text-green-300">
                      The AI output has been decrypted and is ready to view.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white">Decrypted AI Output:</Label>
                    <div className="p-4 bg-white/5 border border-white/20 rounded-lg max-h-96 overflow-y-auto">
                      <pre className="text-sm text-white/90 whitespace-pre-wrap break-words">
                        {typeof viewer.content === 'string' 
                          ? viewer.content 
                          : JSON.stringify(viewer.content, null, 2)
                        }
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-orange-500/20 border border-orange-400/30 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-400 mb-2">
                      <Lock className="h-4 w-4" />
                      <span className="font-medium">Decryption Failed</span>
                    </div>
                    <p className="text-sm text-orange-300 mb-2">
                      Automatic decryption failed. This might be due to a key mismatch or data corruption.
                    </p>
                    <p className="text-xs text-orange-200">
                      💡 You can try manual decryption by entering the key and nonce provided by the data provider.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="decryptKey" className="text-white">Decryption Key</Label>
                      <Input
                        id="decryptKey"
                        type="text"
                        placeholder="Enter the decryption key"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const key = (e.target as HTMLInputElement).value
                            const nonce = (document.getElementById('decryptNonce') as HTMLInputElement)?.value
                            if (key && nonce) {
                              handleDecrypt(viewer.cid!, key, nonce)
                            }
                          }
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="decryptNonce" className="text-white">Nonce</Label>
                      <Input
                        id="decryptNonce"
                        type="text"
                        placeholder="Enter the nonce"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const key = (document.getElementById('decryptKey') as HTMLInputElement)?.value
                            const nonce = (e.target as HTMLInputElement).value
                            if (key && nonce) {
                              handleDecrypt(viewer.cid!, key, nonce)
                            }
                          }
                        }}
                      />
                    </div>
                    
                    <Button 
                      onClick={() => {
                        const key = (document.getElementById('decryptKey') as HTMLInputElement)?.value
                        const nonce = (document.getElementById('decryptNonce') as HTMLInputElement)?.value
                        if (key && nonce && viewer.cid) {
                          handleDecrypt(viewer.cid, key, nonce)
                        } else {
                          toast.error('Please enter both key and nonce')
                        }
                      }}
                      className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 font-medium"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Decrypt Data
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
                  onClick={() => setViewer({ open: false })}
                >
                  Close
                </Button>
                {viewer.content && (
                  <Button 
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30 font-medium"
                    onClick={() => {
                      const data = typeof viewer.content === 'string' 
                        ? viewer.content 
                        : JSON.stringify(viewer.content, null, 2)
                      navigator.clipboard.writeText(data)
                      toast.success('Data copied to clipboard!')
                    }}
                  >
                    Copy Data
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reveal Data Modal */}
      {showRevealModal && currentViewingSignal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white">View Revealed Data for Task #{currentViewingSignal.taskId}</CardTitle>
              <CardDescription className="text-white/70">
                Decrypt the AI output using the provided key and nonce.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {!revealedData ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="decryptionKey" className="text-white/90">Decryption Key</Label>
                    <Input
                      id="decryptionKey"
                      type="text"
                      value={decryptionKey}
                      onChange={(e) => setDecryptionKey(e.target.value)}
                      placeholder="Enter decryption key"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decryptionNonce" className="text-white/90">Decryption Nonce</Label>
                    <Input
                      id="decryptionNonce"
                      type="text"
                      value={decryptionNonce}
                      onChange={(e) => setDecryptionNonce(e.target.value)}
                      placeholder="Enter decryption nonce"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    />
                  </div>
                  <Button
                    onClick={handleDecryptData}
                    disabled={isDecrypting || !decryptionKey || !decryptionNonce}
                    className="w-full bg-gradient-to-r from-blue-400/90 to-blue-500/90 hover:from-blue-400 hover:to-blue-500 text-white font-semibold shadow-lg"
                  >
                    {isDecrypting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Decrypting...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Decrypt Data
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="bg-gray-800 p-4 rounded-md overflow-auto max-h-96">
                  <pre className="text-green-300 text-sm whitespace-pre-wrap">{revealedData}</pre>
                </div>
              )}
              <Button
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
                onClick={() => setShowRevealModal(false)}
              >
                Close
              </Button>
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
