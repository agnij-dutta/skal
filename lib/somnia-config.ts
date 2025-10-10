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
}

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
  COMMIT_REGISTRY: '0xB94ecC5a4cA8D7D2749cE8353F03B38372235C26',
  ESCROW_MANAGER: '0x8F9Cce60CDa5c3b262c30321f40a180A6A9DA762',
  AMM_ENGINE: '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC',
  REPUTATION_MANAGER: '0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8',
  AGENT_REGISTRY: '0x2CC077f1Da27e7e08A1832804B03b30A2990a61C',
} as const

// Market IDs
export const MARKET_IDS = {
  ETH_PRICE_PREDICTION: 1,
  DEFI_SIGNALS: 2,
  NLP_EMBEDDINGS: 3,
} as const
