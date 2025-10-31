'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  Lock, 
  Eye, 
  CheckCircle, 
  Clock, 
  Shield,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCommitTask, useRevealTask, useGetTask, useWatchCommitRegistryEvents, useWatchEscrowManagerEvents } from '@/lib/contracts/hooks'
import { useGetTotalTasks } from '@/lib/contracts/hooks/useCommitRegistry'
import { storageClient } from '@/lib/storage-client'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { generateDeterministicKey, generateDeterministicNonce } from '@/lib/crypto-utils'
import { CONTRACT_ADDRESSES_FLOW as CONTRACT_ADDRESSES, flowEvmTestnet } from '@/lib/flow-config'
import { useFlowActions } from '@/lib/hooks/useFlowActions'
import { useOracleStatus, useWatchOracleEvents } from '@/lib/contracts/hooks/useOracle'

interface CommitStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'current' | 'completed'
}

const baseSteps: CommitStep[] = [
  {
    id: 'prepare',
    title: 'Prepare Output',
    description: 'Upload and encrypt your AI output',
    status: 'current'
  },
  {
    id: 'commit',
    title: 'Commit Hash',
    description: 'Submit commit hash to blockchain',
    status: 'pending'
  },
  {
    id: 'wait',
    title: 'Wait for Buyer',
    description: 'Wait for buyer to lock funds',
    status: 'pending'
  },
  {
    id: 'reveal',
    title: 'Reveal Data',
    description: 'Reveal encrypted data via IPFS',
    status: 'pending'
  },
  {
    id: 'verify',
    title: 'Verification',
    description: 'Wait for verifier validation',
    status: 'pending'
  },
  {
    id: 'settle',
    title: 'Settlement',
    description: 'Receive payment or refund',
    status: 'pending'
  }
]

function CommitContent() {
  const searchParams = useSearchParams()
  const marketId = searchParams.get('market')
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({
    marketId: marketId || '1',
    outputData: '',
    stakeAmount: '0.05',
    description: '',
    encryptionKey: ''
  })
  const [commitHash, setCommitHash] = useState('')
  const [taskId, setTaskId] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [buyerAddress, setBuyerAddress] = useState<string | null>(null)
  const [verificationScore, setVerificationScore] = useState<number | null>(null)
  const [payoutAmount, setPayoutAmount] = useState<string | null>(null)

  // Flow Actions (FLIPs) - automatic auto-reveal
  const flowActions = useFlowActions()
  const [flowActionTriggered, setFlowActionTriggered] = useState(false)
  useEffect(() => {
    // Ensure Flow EVM is the active chain when user lands here
    if (typeof window !== 'undefined' && (window as any).ethereum && chainId && chainId !== flowEvmTestnet.id) {
      switchChain({ chainId: flowEvmTestnet.id }).catch(() => {})
    }
  }, [chainId, switchChain])

  // Automatically trigger Flow Action (autoReveal) when entering Reveal step
  useEffect(() => {
    const run = async () => {
      if (currentStep === 3 && taskId && !flowActionTriggered) {
        try {
          await flowActions.autoReveal(taskId, '0xae8d45e9591b80cb')
          setFlowActionTriggered(true)
          toast.success('Flow Action (autoReveal) submitted automatically')
        } catch (e:any) {
          // Non-fatal; EVM reveal path still available
          console.error('Auto Flow Action failed:', e)
        }
      }
    }
    run()
  }, [currentStep, taskId, flowActionTriggered, flowActions])

  // Contract hooks
  const commitTask = useCommitTask()
  const revealTask = useRevealTask()
  const taskData = useGetTask(taskId || undefined)
  const { totalTasks } = useGetTotalTasks()

  // Fallback: Extract task ID from transaction receipt if event hasn't arrived
  useEffect(() => {
    if (commitTask.isConfirmed && commitTask.receipt && currentStep === 1 && !taskId) {
      console.log('Commit transaction confirmed, extracting task ID from receipt...')
      
      // Try to extract task ID from receipt logs
      try {
        const logs = commitTask.receipt.logs
        console.log('Transaction logs:', logs)
        
        // Find the TaskCommitted event in the logs
        // The TaskCommitted event should have the taskId as the first topic (after the event signature)
        const taskCommittedLog = logs.find((log: any) => 
          log.address.toLowerCase() === CONTRACT_ADDRESSES.COMMIT_REGISTRY.toLowerCase()
        )
        
        if (taskCommittedLog && taskCommittedLog.topics && taskCommittedLog.topics.length > 1) {
          // The taskId is typically in the second topic (topics[1])
          const taskIdHex = taskCommittedLog.topics[1]
          if (taskIdHex) {
            const extractedTaskId = parseInt(taskIdHex, 16)
            console.log('Extracted task ID from receipt:', extractedTaskId)
            setTaskId(extractedTaskId)
          }
        }
      } catch (error) {
        console.error('Failed to extract task ID from receipt:', error)
      }
      
      // Move to waiting for buyer
      setCurrentStep(2)
      toast.success('Commit submitted successfully!')
    }
  }, [commitTask.isConfirmed, commitTask.receipt, currentStep, taskId])

  // Try to get task ID from total tasks count when transaction is confirmed
  // REMOVED: This fallback was causing incorrect task IDs
  // The TaskCommitted event is the source of truth for the task ID

  useEffect(() => {
    if (revealTask.isConfirmed && revealTask.hash && currentStep === 3) {
      console.log('Reveal transaction confirmed, moving to verification step')
      setCurrentStep(4) // Move to verification
      taskData.refetch?.()
      toast.success('Data revealed successfully! Moving to verification...')
    }
  }, [revealTask.isConfirmed, revealTask.hash, currentStep, taskData])

  // Watch for CommitRegistry events (commit, reveal, validate, settle)
  useWatchCommitRegistryEvents(
    (event) => {
      console.log('TaskCommitted event received:', event)
      if (event.provider.toLowerCase() === address?.toLowerCase()) {
        setTaskId(Number(event.taskId))
        // Always move to waiting for buyer first - let EscrowManager events handle buyer detection
        setCurrentStep(2) // Move to waiting for buyer
        taskData.refetch?.()
        toast.success('Commit submitted successfully!')
        
        // Regenerate encryption key with actual task ID for future use
        if (uploadResult) {
          generateDeterministicKey(address, Number(event.taskId)).then(key => {
            console.log('Regenerated key for task:', Number(event.taskId), 'Key:', key.slice(0, 16) + '...')
          })
        }
      }
    },
    (event) => {
      console.log('TaskRevealed event received:', event, 'Current taskId:', taskId)
      if (taskId && Number(event.taskId) === taskId) {
        console.log('Moving to verification step after reveal')
        setCurrentStep(4) // Move to verification after reveal
        taskData.refetch?.()
        toast.success('Data revealed successfully! Moving to verification...')
      }
    },
    (event) => {
      console.log('TaskValidated event received:', event, 'Current taskId:', taskId)
      if (taskId && Number(event.taskId) === taskId) {
        // Verification completed (score available)
        setVerificationScore(Number(event.score))
        setCurrentStep(4)
        taskData.refetch?.()
        toast.success('Verification completed!')
      }
    },
    (event) => {
      console.log('TaskSettled event received:', event, 'Current taskId:', taskId)
      if (taskId && Number(event.taskId) === taskId) {
        setPayoutAmount(event.payout.toString())
        setCurrentStep(5) // Move to settlement
        taskData.refetch?.()
        toast.success('Settlement complete!')
      }
    }
  )

  // Get oracle verification status
  const oracleStatus = useOracleStatus(taskId !== null ? taskId : undefined)

  // Watch for oracle events
  useWatchOracleEvents({
    onVerificationSubmitted: (event) => {
      if (taskId && Number(event.taskId) === taskId) {
        toast.info(`Oracle submitted verification (score: ${event.score})`)
        oracleStatus.refetch()
      }
    },
    onConsensusReached: (event) => {
      if (taskId && Number(event.taskId) === taskId) {
        toast.success(`Consensus reached! Final score: ${event.finalScore}`)
        oracleStatus.refetch()
      }
    },
    onTaskFinalized: (event) => {
      if (taskId && Number(event.taskId) === taskId) {
        setVerificationScore(event.finalScore)
        toast.success(`Verification finalized by ${event.verifiers.length} oracles!`)
        oracleStatus.refetch()
        taskData.refetch?.()
      }
    },
  })

  // Watch for EscrowManager events (buyer locks funds)
  useWatchEscrowManagerEvents(
    (event) => {
      if (taskId && Number(event.taskId) === taskId) {
        setBuyerAddress(event.buyer)
        setCurrentStep(3) // Move to reveal step
        toast.success('Buyer found! You can now reveal your data.')
      }
    }
  )

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }


  const handlePrepareOutput = async () => {
    if (!formData.outputData.trim()) {
      toast.error('Please provide your AI output data')
      return
    }

    if (!address) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsProcessing(true)
    
    try {
      // Generate deterministic key and nonce for this provider and a temporary task ID
      // We'll use a temporary task ID (0) for now, the real task ID will be generated by the contract
      const tempTaskId = 0
      const key = await generateDeterministicKey(address, tempTaskId)
      const nonce = await generateDeterministicNonce(address, tempTaskId)
      
      console.log('Generated encryption key for provider:', address)
      console.log('Key:', key.slice(0, 16) + '...')
      console.log('Nonce:', nonce.slice(0, 16) + '...')
      
      // Upload and encrypt data to IPFS with deterministic key
      const result = await storageClient.encryptAndUpload(
        formData.outputData,
        {
          policyId: 'policy_v1',
          provider: address as `0x${string}`,
          key: key,
          nonce: nonce
        }
      )

      if (!result.success) {
        throw new Error('Failed to upload data')
      }

      setUploadResult(result)
      setCommitHash(result.commitHash)
      
      // Move to next step
      setCurrentStep(1)
      toast.success('Output prepared and encrypted successfully')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to prepare output: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCommit = async () => {
    if (!commitHash) {
      toast.error('No commit hash available')
      return
    }

    if (!address) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsProcessing(true)
    
    try {
      // Submit commit to blockchain
      await commitTask.commitTask(
        commitHash as `0x${string}`,
        parseInt(formData.marketId),
        formData.stakeAmount
      )
      
      // The event listener will handle moving to the next step
      toast.success('Commit transaction submitted!')
    } catch (error) {
      console.error('Commit error:', error)
      toast.error('Failed to submit commit: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReveal = async () => {
    if (!taskId || !uploadResult) {
      toast.error('No task or upload data available')
      return
    }

    if (!address) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsProcessing(true)
    
    try {
      console.log('Starting reveal transaction for task:', taskId, 'with CID:', uploadResult.cid)
      console.log('Current step before reveal:', currentStep)
      
      // Reveal the task with IPFS CID
      await revealTask.revealTask(taskId, uploadResult.cid)
      
      // The event listener will handle moving to the next step
      toast.success('Reveal transaction submitted! Waiting for verification...')
      console.log('Reveal transaction submitted successfully')
    } catch (error) {
      console.error('Reveal error:', error)
      toast.error('Failed to reveal data: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const getStepIcon = (step: CommitStep, index: number) => {
    if (step.status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    } else if (step.status === 'current') {
      return <Clock className="h-5 w-5 text-blue-500" />
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
    }
  }

  // Derive step statuses from currentStep
  const steps: CommitStep[] = baseSteps.map((s, idx) => ({
    ...s,
    status: idx < currentStep ? 'completed' : idx === currentStep ? 'current' : 'pending'
  }))

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Prepare Your AI Output</CardTitle>
              <CardDescription className="text-white/80">
                Upload and encrypt your AI model output for secure trading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="market" className="text-white">Market</Label>
                <Select value={formData.marketId} onValueChange={(value) => handleInputChange('marketId', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select market" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    <SelectItem value="1" className="text-white">ETH Price Prediction</SelectItem>
                    <SelectItem value="2" className="text-white">DeFi Signals</SelectItem>
                    <SelectItem value="3" className="text-white">NLP Embeddings</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your AI output..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="outputData" className="text-white">AI Output Data</Label>
                <Textarea
                  id="outputData"
                  placeholder="Paste your AI model output here (JSON, text, etc.)"
                  value={formData.outputData}
                  onChange={(e) => handleInputChange('outputData', e.target.value)}
                  rows={8}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stakeAmount" className="text-white">Stake Amount (FLOW)</Label>
                <Input
                  id="stakeAmount"
                  type="number"
                  step="0.01"
                  value={formData.stakeAmount}
                  onChange={(e) => handleInputChange('stakeAmount', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <p className="text-sm text-white/70">
                  Minimum stake: 0.05 FLOW. Higher stakes increase trust and visibility.
                </p>
              </div>

              <Alert className="bg-white/5 border-white/20">
                <Lock className="h-4 w-4 text-white/70" />
                <AlertDescription className="text-white/80">
                  Your data will be encrypted using XChaCha20-Poly1305 before being uploaded to IPFS.
                  Only you and verified buyers will have access to the decryption key.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handlePrepareOutput} 
                disabled={isProcessing || !formData.outputData.trim()}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {isProcessing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Preparing Output...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Prepare & Encrypt Output
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )

      case 1:
        return (
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Submit Commit Hash</CardTitle>
              <CardDescription className="text-white/80">
                Submit the encrypted data hash to the blockchain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-white/5 rounded-lg border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-white/70" />
                  <span className="font-medium text-white">Commit Hash</span>
                </div>
                <code className="text-sm break-all text-white/80">{commitHash}</code>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-white">
                  <span>Stake Amount:</span>
                  <span className="font-medium">{formData.stakeAmount} FLOW</span>
                </div>
                <div className="flex justify-between text-white">
                  <span>Gas Fee:</span>
                  <span className="font-medium">~0.001 FLOW</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Total:</span>
                  <span>{(parseFloat(formData.stakeAmount) + 0.001).toFixed(3)} FLOW</span>
                </div>
              </div>

              <Button 
                onClick={handleCommit} 
                disabled={isProcessing || commitTask.isPending || commitTask.isConfirming}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {isProcessing || commitTask.isPending || commitTask.isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {commitTask.isPending ? 'Confirming Transaction...' : 'Submitting Commit...'}
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Submit Commit to Blockchain
                  </>
                )}
              </Button>

              {commitTask.error && (
                <Alert className="bg-red-500/20 border-red-400/30">
                  <AlertDescription className="text-red-300">
                    Error: {commitTask.error.message}
                  </AlertDescription>
                </Alert>
              )}

              {commitTask.hash && (
                <Alert className="bg-blue-500/20 border-blue-400/30">
                  <AlertDescription className="text-blue-300">
                    Transaction Hash: {commitTask.hash}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Waiting for Buyer</CardTitle>
              <CardDescription className="text-white/80">
                Your commit is live! Waiting for a buyer to lock funds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Eye className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Task ID: #{taskId}</h3>
                  <p className="text-white/70">Your commit is visible to buyers</p>
                </div>
              </div>

              <div className="space-y-2 text-white">
                <div className="flex justify-between">
                  <span>Task ID:</span>
                  <span className="font-mono">{taskId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commit Hash:</span>
                  <code className="text-sm text-white/80">{commitHash.slice(0, 20)}...</code>
                </div>
                <div className="flex justify-between">
                  <span>Stake Amount:</span>
                  <span>{formData.stakeAmount} FLOW</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {taskData.task ? 'Committed' : 'Waiting for Buyer'}
                  </Badge>
                </div>
                {taskData.task && (
                  <div className="flex justify-between">
                    <span>Provider:</span>
                    <code className="text-sm text-white/80">{taskData.task.provider.slice(0, 10)}...</code>
                  </div>
                )}
              </div>

              <Alert className="bg-white/5 border-white/20">
                <Clock className="h-4 w-4 text-white/70" />
                <AlertDescription className="text-white/80">
                  You&apos;ll be notified when a buyer locks funds. You can then reveal your data.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Reveal Your Data</CardTitle>
              <CardDescription className="text-white/80">
                A buyer has locked funds! Now reveal your encrypted data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-green-500/20 border border-green-400/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Buyer Found!</span>
                </div>
                <p className="text-sm text-green-300 mt-1">
                  Funds have been locked. You can now reveal your data.
                </p>
              </div>

              <Button 
                onClick={handleReveal} 
                disabled={isProcessing || revealTask.isPending || revealTask.isConfirming}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {isProcessing || revealTask.isPending || revealTask.isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {revealTask.isPending ? 'Confirming Transaction...' : 'Revealing Data...'}
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Reveal Encrypted Data
                  </>
                )}
              </Button>


              {revealTask.error && (
                <Alert className="bg-red-500/20 border-red-400/30">
                  <AlertDescription className="text-red-300">
                    Error: {revealTask.error.message}
                  </AlertDescription>
                </Alert>
              )}

              {revealTask.hash && (
                <Alert className="bg-blue-500/20 border-blue-400/30">
                  <AlertDescription className="text-blue-300">
                    Transaction Hash: {revealTask.hash}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Oracle Verification in Progress</CardTitle>
              <CardDescription className="text-white/80">
                Multiple oracles are independently verifying your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Shield className="h-8 w-8 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{oracleStatus.message}</h3>
                  <p className="text-white/70">
                    {oracleStatus.stage === 'collecting' && `${oracleStatus.submissionCount} of ${oracleStatus.oracleCount || 3} oracles submitted`}
                    {oracleStatus.stage === 'consensus' && 'Consensus reached, finalizing...'}
                    {oracleStatus.stage === 'finalized' && 'Verification complete!'}
                    {oracleStatus.stage === 'idle' && 'Waiting for oracle submissions...'}
                  </p>
                </div>
              </div>

              {/* Oracle Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-white/80">
                  <span>Oracle Progress</span>
                  <span>{Math.round(oracleStatus.progress)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                    style={{ width: `${oracleStatus.progress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-white">
                <div className="flex justify-between">
                  <span>Oracle Submissions:</span>
                  <Badge className="bg-white/20 text-white border-white/30">
                    {oracleStatus.submissionCount} / {oracleStatus.oracleCount || 3}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Consensus Status:</span>
                  <Badge className="bg-white/20 text-white border-white/30">
                    {oracleStatus.hasConsensus ? '✓ Reached' : 'Pending'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Time Remaining:</span>
                  <span>{oracleStatus.timeRemaining > 0 ? `${Math.floor(oracleStatus.timeRemaining / 60)}m ${oracleStatus.timeRemaining % 60}s` : 'N/A'}</span>
                </div>
              </div>

              {/* Show automatic decryption info */}
              <div className="p-4 bg-green-500/20 border border-green-400/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-3">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Automatic Decryption</span>
                </div>
                <p className="text-sm text-green-300 mb-2">
                  Buyers will be able to automatically decrypt your data using a secure key generation system.
                </p>
                <p className="text-xs text-green-200">
                  🔐 No manual key sharing required - the system handles encryption/decryption automatically.
                </p>
              </div>

              <Alert className="bg-white/5 border-white/20">
                <Clock className="h-4 w-4 text-white/70" />
                <AlertDescription className="text-white/80">
                  You&apos;ll be notified once verification is complete and funds are released.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Verification Complete!</CardTitle>
              <CardDescription className="text-white/80">
                Your data has been verified and payment processed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-400">Success!</h3>
                  <p className="text-white/70">Your data was verified and payment received</p>
                </div>
              </div>

              <div className="space-y-2 text-white">
                <div className="flex justify-between">
                  <span>Verification Score:</span>
                  <span className="font-medium text-green-400">98.5%</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Received:</span>
                  <span className="font-medium">{formData.stakeAmount} FLOW</span>
                </div>
                <div className="flex justify-between">
                  <span>Reputation Gain:</span>
                  <span className="font-medium text-green-400">+15</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30" asChild>
                  <Link href="/markets">View Markets</Link>
                </Button>
                <Button className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30" asChild>
                  <Link href="/commit">Create Another</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-white">Commit AI Output</h1>
        <p className="text-white/80 text-lg">
          Securely commit your AI model output to the Shadow Protocol
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Steps */}
        <div className="lg:col-span-1">
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Commit Process</CardTitle>
              <CardDescription className="text-white/80">Follow these steps to commit your output</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    {getStepIcon(step, index)}
                    <div className="flex-1">
                      <p className={`font-medium ${step.status === 'current' ? 'text-blue-400' : 'text-white'}`}>
                        {step.title}
                      </p>
                      <p className="text-sm text-white/70">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          {renderStepContent()}
        </div>
      </div>
    </div>
  )
}

export default function CommitPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 pt-24 pb-8">Loading...</div>}>
      <CommitContent />
    </Suspense>
  )
}
