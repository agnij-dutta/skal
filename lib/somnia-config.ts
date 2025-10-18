// Somnia Network Configuration
export const somniaTestnet = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia Test Token',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network/'],
    },
    public: {
      http: ['https://dream-rpc.somnia.network/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Shannon Explorer',
      url: 'https://shannon-explorer.somnia.network/',
    },
    alternative: {
      name: 'SocialScan',
      url: 'https://somnia-testnet.socialscan.io/',
    },
  },
  testnet: true,
  faucet: 'https://testnet.somnia.network/',
} as const

// Flow EVM Testnet Configuration
export const flowEVMTestnet = {
  id: 545,
  name: 'Flow EVM Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Flow',
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
      url: 'https://testnet.flowscan.io/',
    },
  },
  testnet: true,
} as const

export const somniaMainnet = {
  id: 5031,
  name: 'Somnia Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia',
    symbol: 'SOMI',
  },
  rpcUrls: {
    default: {
      http: ['https://api.infra.mainnet.somnia.network/'],
    },
    public: {
      http: ['https://api.infra.mainnet.somnia.network/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://explorer.somnia.network',
    },
  },
  testnet: false,
  faucet: 'https://stakely.io/faucet/somnia-somi',
}

// Contract addresses on Somnia testnet
export const CONTRACT_ADDRESSES = {
  COMMIT_REGISTRY: '0x8D7cd1c2bEcA4eb4cE7aa0fA37eCB61ea125171f',
  ESCROW_MANAGER: '0x5952b85E23388130A0D2C34B1151A4d60414d998',
  AMM_ENGINE: '0x463f717e81182B3949b7d0382d30471984921f2f',
  REPUTATION_MANAGER: '0xd1077A0D78b8F6969f16c7409CdaB566B6d62486',
  AGENT_REGISTRY: '0x4cc020E6eC340401cdb4f89fC09E5ad3920E5E46',
} as const

// Contract addresses on Flow EVM testnet
export const FLOW_EVM_CONTRACT_ADDRESSES = {
  COMMIT_REGISTRY: '0xA68b3808DCf0Fd8630640018fCB96a28f497F504',
  ESCROW_MANAGER: '0x310BE1F533FFE873743A00aCBB69c22C980c2ECc',
  AMM_ENGINE: '0xdC13a4eD2717a7b1E0dE2E55beF927c291A4fA0e',
  REPUTATION_MANAGER: '0xAF16AdAE0A157C92e2B173F2579e1f063A7aABE7',
  AGENT_REGISTRY: '0x02A56612A4D8D7ae38BD577Be3222D26a4846032',
} as const

// Market IDs
export const MARKET_IDS = {
  ETH_PRICE_PREDICTION: 1,
  DEFI_SIGNALS: 2,
  NLP_EMBEDDINGS: 3,
} as const
