const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting Shadow Protocol deployment...");

  // Get the contract factories
  const CommitRegistry = await ethers.getContractFactory("CommitRegistry");
  const EscrowManager = await ethers.getContractFactory("EscrowManager");
  const AMMEngine = await ethers.getContractFactory("AMMEngine");
  const ReputationManager = await ethers.getContractFactory("ReputationManager");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy contracts in order
  console.log("\n📝 Deploying CommitRegistry...");
  const commitRegistry = await CommitRegistry.deploy();
  await commitRegistry.waitForDeployment();
  const commitRegistryAddress = await commitRegistry.getAddress();
  console.log("CommitRegistry deployed to:", commitRegistryAddress);

  console.log("\n💰 Deploying EscrowManager...");
  const escrowManager = await EscrowManager.deploy(deployer.address); // Use deployer as fee collector
  await escrowManager.waitForDeployment();
  const escrowManagerAddress = await escrowManager.getAddress();
  console.log("EscrowManager deployed to:", escrowManagerAddress);

  console.log("\n🏪 Deploying AMMEngine...");
  const ammEngine = await AMMEngine.deploy(deployer.address); // Use deployer as fee collector
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
  
  // CommitRegistry references
  await commitRegistry.setExternalContracts(
    escrowManagerAddress,
    reputationManagerAddress,
    agentRegistryAddress
  );
  console.log("✅ CommitRegistry references set");

  // EscrowManager references
  await escrowManager.setExternalContracts(
    commitRegistryAddress,
    reputationManagerAddress,
    agentRegistryAddress
  );
  console.log("✅ EscrowManager references set");

  // AMMEngine references
  await ammEngine.setExternalContracts(
    commitRegistryAddress,
    escrowManagerAddress
  );
  console.log("✅ AMMEngine references set");

  // ReputationManager references
  await reputationManager.setExternalContracts(
    commitRegistryAddress,
    escrowManagerAddress,
    ammEngineAddress
  );
  console.log("✅ ReputationManager references set");

  // AgentRegistry references
  await agentRegistry.setExternalContracts(
    reputationManagerAddress,
    escrowManagerAddress
  );
  console.log("✅ AgentRegistry references set");

  // Create some test markets
  console.log("\n🏪 Creating test markets...");
  
  // Market 1: ETH Price Prediction (using ETH as base token)
  await ammEngine.createMarket(1, ethers.ZeroAddress, "0x0000000000000000000000000000000000000001"); // ETH to different token
  console.log("✅ Market 1 created: ETH Price Prediction");

  // Market 2: DeFi Signals
  await ammEngine.createMarket(2, ethers.ZeroAddress, "0x0000000000000000000000000000000000000002");
  console.log("✅ Market 2 created: DeFi Signals");

  // Market 3: NLP Embeddings
  await ammEngine.createMarket(3, ethers.ZeroAddress, "0x0000000000000000000000000000000000000003");
  console.log("✅ Market 3 created: NLP Embeddings");

  // Summary
  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("CommitRegistry:", commitRegistryAddress);
  console.log("EscrowManager:", escrowManagerAddress);
  console.log("AMMEngine:", ammEngineAddress);
  console.log("ReputationManager:", reputationManagerAddress);
  console.log("AgentRegistry:", agentRegistryAddress);

  console.log("\n📊 Test Markets Created:");
  console.log("Market 1: ETH Price Prediction");
  console.log("Market 2: DeFi Signals");
  console.log("Market 3: NLP Embeddings");

  console.log("\n🔧 Next Steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Deploy agents and connect to contracts");
  console.log("3. Test commit→reveal→verify flow");
  console.log("4. Add initial liquidity to markets");

  // Save deployment info to file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
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

  const fs = require('fs');
  fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
