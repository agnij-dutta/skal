'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { Button } from './ui/button'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { injected } from 'wagmi/connectors'
import { shortenAddress } from '@/lib/utils'

interface WalletConnectProps {
  className?: string
}

export function WalletConnect({ className }: WalletConnectProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  
  const { address, isConnected } = useAccount()
  const { connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const connectWallet = async () => {
    try {
      // First switch to the correct network
      try {
        await switchChain({ chainId: 50312 }) // Somnia Testnet
      } catch (switchError: any) {
        // If the chain doesn't exist, add it
        if (switchError?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xc488', // 50312 in hex
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
        } else {
          throw switchError
        }
      }

      // Connect wallet
      connect({ 
        connector: injected(),
        chainId: 50312 
      })
      
      toast.success('Wallet connected successfully!')
      router.push('/markets')
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      toast.error('Failed to connect wallet')
    }
  }

  const disconnectWallet = () => {
    disconnect()
    toast.success('Wallet disconnected')
    router.push('/')
  }

  const copyAddress = async () => {
    if (!address) return
    
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy address')
    }
  }


  if (isConnected && address) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          size="sm"
          onClick={copyAddress}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          onClick={disconnectWallet}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {shortenAddress(address)}
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

