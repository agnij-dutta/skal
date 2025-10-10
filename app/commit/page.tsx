'use client'

import { useState, Suspense } from 'react'
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
  Shield
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface CommitStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'current' | 'completed'
}

const steps: CommitStep[] = [
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
  
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({
    marketId: marketId || '1',
    outputData: '',
    stakeAmount: '0.05',
    description: '',
    encryptionKey: ''
  })
  const [commitHash, setCommitHash] = useState('')
  const [taskId, setTaskId] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePrepareOutput = async () => {
    if (!formData.outputData.trim()) {
      toast.error('Please provide your AI output data')
      return
    }

    setIsProcessing(true)
    
    try {
      // Simulate encryption and upload
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockCommitHash = `0x${Math.random().toString(16).substr(2, 64)}`
      setCommitHash(mockCommitHash)
      
      // Move to next step
      setCurrentStep(1)
      toast.success('Output prepared and encrypted successfully')
    } catch (error) {
      toast.error('Failed to prepare output')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCommit = async () => {
    if (!commitHash) {
      toast.error('No commit hash available')
      return
    }

    setIsProcessing(true)
    
    try {
      // Simulate blockchain transaction
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const mockTaskId = Math.floor(Math.random() * 1000000).toString()
      setTaskId(mockTaskId)
      
      // Move to next step
      setCurrentStep(2)
      toast.success('Commit submitted to blockchain')
    } catch (error) {
      toast.error('Failed to submit commit')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReveal = async () => {
    setIsProcessing(true)
    
    try {
      // Simulate reveal process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Move to next step
      setCurrentStep(4)
      toast.success('Data revealed successfully')
    } catch (error) {
      toast.error('Failed to reveal data')
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
                <Label htmlFor="stakeAmount" className="text-white">Stake Amount (STT)</Label>
                <Input
                  id="stakeAmount"
                  type="number"
                  step="0.01"
                  value={formData.stakeAmount}
                  onChange={(e) => handleInputChange('stakeAmount', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <p className="text-sm text-white/70">
                  Minimum stake: 0.05 STT. Higher stakes increase trust and visibility.
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
                  <span className="font-medium">{formData.stakeAmount} STT</span>
                </div>
                <div className="flex justify-between text-white">
                  <span>Gas Fee:</span>
                  <span className="font-medium">~0.001 STT</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Total:</span>
                  <span>{(parseFloat(formData.stakeAmount) + 0.001).toFixed(3)} STT</span>
                </div>
              </div>

              <Button 
                onClick={handleCommit} 
                disabled={isProcessing}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {isProcessing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Submitting Commit...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Submit Commit to Blockchain
                  </>
                )}
              </Button>
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
                  <span>Commit Hash:</span>
                  <code className="text-sm text-white/80">{commitHash.slice(0, 20)}...</code>
                </div>
                <div className="flex justify-between">
                  <span>Stake Amount:</span>
                  <span>{formData.stakeAmount} STT</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="outline" className="bg-white/20 text-white border-white/30">Waiting for Buyer</Badge>
                </div>
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
                disabled={isProcessing}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                {isProcessing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Revealing Data...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Reveal Encrypted Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Verification in Progress</CardTitle>
              <CardDescription className="text-white/80">
                Your data is being verified by the network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Shield className="h-8 w-8 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Verification in Progress</h3>
                  <p className="text-white/70">Verifiers are checking your data</p>
                </div>
              </div>

              <div className="space-y-2 text-white">
                <div className="flex justify-between">
                  <span>Verification Status:</span>
                  <Badge variant="outline" className="bg-white/20 text-white border-white/30">In Progress</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Time:</span>
                  <span>2-5 minutes</span>
                </div>
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
                  <span className="font-medium">{formData.stakeAmount} STT</span>
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
                <Button variant="outline" className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30" asChild>
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
