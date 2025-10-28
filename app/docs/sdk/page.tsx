'use client'

import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SDKDocsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 pt-24 pb-8">Loading...</div>}>
      <div className="container mx-auto px-4 pt-24 pb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-white">Agents SDK</h1>
          <p className="text-white/80 text-lg">Build Flow-ready autonomous agents with Flow Actions and Scheduled Transactions.</p>
        </div>

        <div className="space-y-6">
          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Installation</CardTitle>
              <CardDescription className="text-white/80">Install the SDK</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-black/40 text-white p-4 rounded-md overflow-auto"><code>npm install @skal/agents-sdk</code></pre>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Quick Start</CardTitle>
              <CardDescription className="text-white/80">Initialize with Flow EVM Testnet</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-black/40 text-white p-4 rounded-md overflow-auto"><code>{`import { FlowAdapter } from '@skal/agents-sdk'

const adapter = new FlowAdapter({
  chainId: 'flow-testnet',
  name: 'Flow Testnet',
  rpcUrl: 'https://testnet.evm.nodes.onflow.org',
  nativeCurrency: { symbol: 'FLOW', decimals: 18 },
  contracts: {
    commitRegistry: '0x...',
    escrowManager: '0x...',
    ammEngine: '0x...',
    reputationManager: '0x...',
    agentRegistry: '0x...',
  },
})

await adapter.initialize()`}</code></pre>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Core Flows</CardTitle>
              <CardDescription className="text-white/80">Commit, Buy, Liquidity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-white/90 font-semibold mb-2">Commit a Signal</p>
                <pre className="bg-black/40 text-white p-4 rounded-md overflow-auto"><code>{`const signalId = await adapter.commitSignal(commitHash, marketId, stake)`}</code></pre>
              </div>
              <div>
                <p className="text-white/90 font-semibold mb-2">Buy a Signal</p>
                <pre className="bg-black/40 text-white p-4 rounded-md overflow-auto"><code>{`await adapter.buySignal(signalId, '0.05') // FLOW`}</code></pre>
              </div>
              <div>
                <p className="text-white/90 font-semibold mb-2">Add Liquidity</p>
                <pre className="bg-black/40 text-white p-4 rounded-md overflow-auto"><code>{`await adapter.addLiquidity(marketId, '1.0', '1.0') // FLOW/ETH pool`}</code></pre>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Scheduled Transactions</CardTitle>
              <CardDescription className="text-white/80">Automate agent behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-black/40 text-white p-4 rounded-md overflow-auto"><code>{`await adapter.scheduleTransaction('AutoRevealHandler', 86400, { signalId })`}</code></pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </Suspense>
  )
}


