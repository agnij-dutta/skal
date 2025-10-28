'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from 'wagmi'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Wallet, LogOut, Copy, Check, Network } from 'lucide-react'
import { toast } from 'sonner'
import { injected } from 'wagmi/connectors'
import { shortenAddress } from '@/lib/utils'
import { flowEvmTestnet } from '@/lib/flow-config'

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
  const chainId = useChainId()

  const connectWallet = async () => {
    try {
      // First switch to Flow EVM
      try {
        await switchChain({ chainId: flowEvmTestnet.id })
      } catch (switchError: any) {
        // If the chain doesn't exist, add it
        if (switchError?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${flowEvmTestnet.id.toString(16)}`,
              chainName: flowEvmTestnet.name,
              nativeCurrency: flowEvmTestnet.nativeCurrency,
              rpcUrls: flowEvmTestnet.rpcUrls.default.http,
              blockExplorerUrls: flowEvmTestnet.blockExplorers?.default?.url ? [flowEvmTestnet.blockExplorers.default.url] : [],
            }],
          })
        } else {
          throw switchError
        }
      }

      // Connect wallet
      connect({ 
        connector: injected(),
        chainId: flowEvmTestnet.id 
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

  const handleNetworkChange = async (newChainId: string) => {
    try {
      await switchChain({ chainId: Number(newChainId) })
      toast.success('Network switched')
    } catch (error) {
      console.error('Failed to switch network:', error)
      toast.error('Failed to switch network')
    }
  }

  const getNetworkName = () => {
    if (chainId === flowEvmTestnet.id) return 'Flow EVM'
    return 'Other'
  }


  if (isConnected && address) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Select value={chainId.toString()} onValueChange={handleNetworkChange}>
          <SelectTrigger className="w-[140px] bg-white/10 border-white/20 text-white">
            <Network className="h-4 w-4 mr-2" />
            <SelectValue>{getNetworkName()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={flowEvmTestnet.id.toString()}>Flow EVM</SelectItem>
          </SelectContent>
        </Select>
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

