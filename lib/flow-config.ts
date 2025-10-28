// Flow Blockchain Configuration

export const flowEvmTestnet = {
  id: 545,
  name: 'Flow EVM Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'FLOW',
    symbol: 'FLOW',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet.evm.nodes.onflow.org'],
    },
    public: {
      http: ['https://testnet.evm.nodes.onflow.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Flow EVM Explorer',
      url: 'https://evm-testnet.flowscan.org',
    },
  },
  testnet: true,
  faucet: 'https://testnet-faucet.onflow.org/',
} as const

export const flowTestnet = {
  id: 746,
  name: 'Flow Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'FLOW',
    symbol: 'FLOW',
  },
  rpcUrls: {
    default: {
      http: ['https://rest-testnet.onflow.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Flow Testnet Explorer',
      url: 'https://testnet.flowscan.org',
    },
  },
  testnet: true,
} as const

export const flowMainnet = {
  id: 747,
  name: 'Flow Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'FLOW',
    symbol: 'FLOW',
  },
  rpcUrls: {
    default: {
      http: ['https://rest-mainnet.onflow.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Flow Explorer',
      url: 'https://flowscan.org',
    },
  },
  testnet: false,
} as const

// Contract addresses on Flow EVM testnet (deployed addresses)
export const CONTRACT_ADDRESSES_FLOW = {
  COMMIT_REGISTRY: '0x21b165aE60748410793e4c2ef248940dc31FE773',
  ESCROW_MANAGER: '0x4D1E494CaB138D8c23B18c975b49C1Bec7902746',
  AMM_ENGINE: '0xb9Df841a5b5f4a7f23F2294f3eecB5b2e2F53CFD',
  REPUTATION_MANAGER: '0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387',
  AGENT_REGISTRY: '0x3F944e66a9513E1a2606288199d39bC974067348',
  ORACLE_REGISTRY: '0x8a46920723fcFEC1241A4980854E21442D8B96e0',
  VERIFICATION_AGGREGATOR: '0xDB49635E5Eb88719A1281CDa32578fA1837297E9',
} as const

// Contract addresses for Cadence contracts (will be populated after deployment)
export const CONTRACT_ADDRESSES_CADENCE = {
  SIGNAL_COMMIT_REGISTRY: process.env.NEXT_PUBLIC_CADENCE_COMMIT_REGISTRY || '',
  SIGNAL_ESCROW: process.env.NEXT_PUBLIC_CADENCE_ESCROW || '',
  SIGNAL_MARKET_AMM: process.env.NEXT_PUBLIC_CADENCE_AMM || '',
  AGENT_COORDINATOR: process.env.NEXT_PUBLIC_CADENCE_AGENT_COORDINATOR || '',
} as const

// Market IDs (same across all chains)
export const MARKET_IDS = {
  ETH_PRICE_PREDICTION: 1,
  DEFI_SIGNALS: 2,
  NLP_EMBEDDINGS: 3,
} as const
