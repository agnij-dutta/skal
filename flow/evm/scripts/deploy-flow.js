const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting Shadow Protocol deployment to Flow EVM Testnet...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ Insufficient balance! Get Flow testnet ETH from: https://testnet-faucet.onflow.org/");
    process.exit(1);
  }

  // Get the contract factories
  const CommitRegistry = await ethers.getContractFactory("CommitRegistry");
  const EscrowManager = await ethers.getContractFactory("EscrowManager");
  const AMMEngine = await ethers.getContractFactory("AMMEngine");
  const ReputationManager = await ethers.getContractFactory("ReputationManager");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");

  // Deploy contracts in order
  console.log("\n📝 Deploying CommitRegistry...");
  const commitRegistry = await CommitRegistry.deploy();
  await commitRegistry.waitForDeployment();
  const commitRegistryAddress = await commitRegistry.getAddress();
  console.log("CommitRegistry deployed to:", commitRegistryAddress);

  console.log("\n💰 Deploying EscrowManager...");
  const escrowManager = await EscrowManager.deploy(deployer.address);
  await escrowManager.waitForDeployment();
  const escrowManagerAddress = await escrowManager.getAddress();
  console.log("EscrowManager deployed to:", escrowManagerAddress);

  console.log("\n🏪 Deploying AMMEngine...");
  const ammEngine = await AMMEngine.deploy(deployer.address);
  await ammEngine.waitForDeployment();
  const ammEngineAddress = await ammEngine.getAddress();
  console.log("AMMEngine deployed to:", ammEngineAddress);

  console.log("\n⭐ Deploying ReputationManager...");
  const reputationManager = await ReputationManager.deploy();
  await reputationManager.waitForDeployment();
  const reputationManagerAddress = await reputationManager.getAddress();
  console.log("ReputationManager deployed to:", reputationManagerAddress);

  console.log("\n🤖 Deploying AgentRegistry...");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("AgentRegistry deployed to:", agentRegistryAddress);

  // Set up cross-contract references
  console.log("\n🔗 Setting up cross-contract references...");
  
  await commitRegistry.setExternalContracts(
    escrowManagerAddress,
    reputationManagerAddress,
    agentRegistryAddress
  );
  console.log("✅ CommitRegistry references set");

  await escrowManager.setExternalContracts(
    commitRegistryAddress,
    reputationManagerAddress,
    agentRegistryAddress
  );
  console.log("✅ EscrowManager references set");

  await ammEngine.setExternalContracts(
    commitRegistryAddress,
    escrowManagerAddress
  );
  console.log("✅ AMMEngine references set");

  await reputationManager.setExternalContracts(
    commitRegistryAddress,
    escrowManagerAddress,
    ammEngineAddress
  );
  console.log("✅ ReputationManager references set");

  await agentRegistry.setExternalContracts(
    reputationManagerAddress,
    escrowManagerAddress
  );
  console.log("✅ AgentRegistry references set");

  // Create test markets
  console.log("\n🏪 Creating test markets...");
  
  await ammEngine.createMarket(1, ethers.ZeroAddress, ethers.ZeroAddress);
  console.log("✅ Market 1 created: ETH Price Prediction");

  await ammEngine.createMarket(2, ethers.ZeroAddress, ethers.ZeroAddress);
  console.log("✅ Market 2 created: DeFi Signals");

  await ammEngine.createMarket(3, ethers.ZeroAddress, ethers.ZeroAddress);
  console.log("✅ Market 3 created: NLP Embeddings");

  // Summary
  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("CommitRegistry:", commitRegistryAddress);
  console.log("EscrowManager:", escrowManagerAddress);
  console.log("AMMEngine:", ammEngineAddress);
  console.log("ReputationManager:", reputationManagerAddress);
  console.log("AgentRegistry:", agentRegistryAddress);

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: "flow-evm-testnet",
    chainId: 545,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      CommitRegistry: commitRegistryAddress,
      EscrowManager: escrowManagerAddress,
      AMMEngine: ammEngineAddress,
      ReputationManager: reputationManagerAddress,
      AgentRegistry: agentRegistryAddress,
    },
    markets: {
      1: "ETH Price Prediction",
      2: "DeFi Signals",
      3: "NLP Embeddings"
    }
  };

  fs.writeFileSync('deployment-flow.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to deployment-flow.json");
  
  console.log("\n🌐 Block Explorer: https://evm-testnet.flowscan.org");
  console.log("🔍 Verify contracts using the addresses above");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
