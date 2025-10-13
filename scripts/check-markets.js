const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.local' });

const AMM_ENGINE_ADDRESS = '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC';
const RPC_URL = 'https://dream-rpc.somnia.network/';

// ABI for getMarket function
const AMM_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "marketId", "type": "uint256"}],
    "name": "getMarket",
    "outputs": [
      {"internalType": "uint256", "name": "marketId", "type": "uint256"},
      {"internalType": "address", "name": "tokenA", "type": "address"},
      {"internalType": "address", "name": "tokenB", "type": "address"},
      {"internalType": "uint256", "name": "reserveA", "type": "uint256"},
      {"internalType": "uint256", "name": "reserveB", "type": "uint256"},
      {"internalType": "uint256", "name": "totalSupply", "type": "uint256"},
      {"internalType": "bool", "name": "active", "type": "bool"},
      {"internalType": "uint256", "name": "createdAt", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "marketId", "type": "uint256"},
      {"internalType": "address", "name": "tokenA", "type": "address"},
      {"internalType": "address", "name": "tokenB", "type": "address"}
    ],
    "name": "createMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

async function checkMarkets() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PROVIDER_PK, provider);
  const ammEngine = new ethers.Contract(AMM_ENGINE_ADDRESS, AMM_ABI, wallet);

  console.log('Checking markets...');
  
  for (let marketId = 1; marketId <= 3; marketId++) {
    try {
      const market = await ammEngine.getMarket(marketId);
      console.log(`Market ${marketId}:`, {
        marketId: market.marketId.toString(),
        tokenA: market.tokenA,
        tokenB: market.tokenB,
        reserveA: ethers.formatEther(market.reserveA),
        reserveB: ethers.formatEther(market.reserveB),
        totalSupply: ethers.formatEther(market.totalSupply),
        active: market.active,
        createdAt: new Date(Number(market.createdAt) * 1000).toISOString()
      });
    } catch (error) {
      console.log(`Market ${marketId}: Not found or error - ${error.message}`);
      
      // Try to create the market
      try {
        console.log(`Creating market ${marketId}...`);
        const tx = await ammEngine.createMarket(
          marketId,
          ethers.ZeroAddress, // STT token (address(0))
          ethers.ZeroAddress  // STT token (address(0))
        );
        await tx.wait();
        console.log(`Market ${marketId} created successfully!`);
      } catch (createError) {
        console.log(`Failed to create market ${marketId}: ${createError.message}`);
      }
    }
  }
}

checkMarkets().catch(console.error);

