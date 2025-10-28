const { ethers } = require('ethers');

async function registerOracle() {
  console.log('🔮 Registering Oracle...');
  
  // Use the same wallet as the agents
  const privateKey = '0x95492791d9e40b7771b8b57117c399cc5e27d99d4959b7f9592925a398be7bdb';
  const provider = new ethers.JsonRpcProvider('https://testnet.evm.nodes.onflow.org');
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('Wallet address:', wallet.address);
  
  const oracleRegistryAddress = '0x8a46920723fcFEC1241A4980854E21442D8B96e0';
  
  // OracleRegistry ABI for registration
  const abi = [
    'function registerOracle() external payable',
    'function isOracleRegistered(address oracle) external view returns (bool)',
    'function getOracleCount() external view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(oracleRegistryAddress, abi, wallet);
  
  try {
    // Check if already registered
    const isRegistered = await contract.isOracleRegistered(wallet.address);
    console.log('Already registered:', isRegistered);
    
    if (!isRegistered) {
      console.log('Registering oracle...');
      const stakeAmount = ethers.parseEther('0.1'); // 0.1 FLOW stake
      
      const tx = await contract.registerOracle({
        value: stakeAmount,
        gasLimit: 500000
      });
      
      console.log('Transaction hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('Registration confirmed in block:', receipt.blockNumber);
    }
    
    // Verify registration
    const isRegisteredAfter = await contract.isOracleRegistered(wallet.address);
    console.log('Registration successful:', isRegisteredAfter);
    
    const count = await contract.getOracleCount();
    console.log('Total oracles:', count.toString());
    
  } catch (error) {
    console.error('Registration error:', error.message);
  }
}

registerOracle();
