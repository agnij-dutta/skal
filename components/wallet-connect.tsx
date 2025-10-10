'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/button'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface WalletConnectProps {
  className?: string
}

export function WalletConnect({ className }: WalletConnectProps) {
  const router = useRouter()
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          if (accounts.length > 0) {
            setIsConnected(true)
            setAddress(accounts[0])
          }
        } catch (error) {
          console.error('Failed to check wallet connection:', error)
        }
      }
    }
    
    checkConnection()
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setIsConnected(true)
          setAddress(accounts[0])
        } else {
          setIsConnected(false)
          setAddress('')
          // Redirect to landing page on disconnect
          router.push('/')
        }
      })
    }
  }, [router])

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('Please install MetaMask or another Web3 wallet')
      return
    }

    setIsConnecting(true)
    
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (accounts.length > 0) {
        setIsConnected(true)
        setAddress(accounts[0])
        
        // Try to switch to Somnia testnet
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xC468' }], // 50312 in hex
          })
        } catch (switchError: any) {
          // If the chain doesn't exist, add it
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xC468', // 50312 in hex
                  chainName: 'Somnia Testnet',
                  nativeCurrency: {
                    name: 'Somnia Test Token',
                    symbol: 'STT',
                    decimals: 18,
                  },
                  rpcUrls: ['https://dream-rpc.somnia.network/'],
                  blockExplorerUrls: ['https://shannon-explorer.somnia.network/'],
                }],
              })
            } catch (addError) {
              console.error('Failed to add Somnia testnet:', addError)
              toast.error('Failed to add Somnia testnet to wallet')
            }
          } else {
            console.error('Failed to switch to Somnia testnet:', switchError)
            toast.error('Failed to switch to Somnia testnet')
          }
        }
        
        toast.success('Wallet connected successfully!')
        // Redirect to markets page on successful connection
        router.push('/markets')
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      toast.error('Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setIsConnected(false)
    setAddress('')
    toast.success('Wallet disconnected')
    // Redirect to landing page on disconnect
    router.push('/')
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy address')
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (isConnected) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={copyAddress}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={disconnectWallet}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {formatAddress(address)}
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={connectWallet}
      disabled={isConnecting}
      className={`bg-white/10 border-white/20 text-white hover:bg-white/20 ${className}`}
    >
      <Wallet className="h-4 w-4 mr-2" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (accounts: string[]) => void) => void
      selectedAddress?: string
    }
  }
}
