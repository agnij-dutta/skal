const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("\n🔮 Deploying Oracle Network Infrastructure (Fresh)...");
  console.log("=".repeat(50));

  const [deployer] = await hre.ethers.getSigners();
  console.log("\n📍 Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "STT");
  
  // Get current nonce with pending transactions
  const nonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log("🔢 Current nonce (pending):", nonce);

  // Load existing deployment
  const deploymentPath = path.join(__dirname, '../deployment.json');
  let deployment = {};
  
  if (fs.existsSync(deploymentPath)) {
    const fileContent = fs.readFileSync(deploymentPath, 'utf8').trim();
    if (fileContent) {
      try {
        deployment = JSON.parse(fileContent);
        console.log("\n📋 Loaded existing deployment config");
      } catch (error) {
        console.log("\n⚠️  Invalid deployment.json, starting fresh");
        deployment = {};
      }
    } else {
      console.log("\n📋 Empty deployment.json, starting fresh");
      deployment = {};
    }
  }

  // Check if oracle contracts already exist
  const existingOracleRegistry = deployment.oracleRegistry;
  const existingVerificationAggregator = deployment.verificationAggregator;
  
  if (existingOracleRegistry && existingVerificationAggregator) {
    console.log("\n✅ Oracle contracts already deployed:");
    console.log("   OracleRegistry:", existingOracleRegistry);
    console.log("   VerificationAggregator:", existingVerificationAggregator);
    
    // Verify contracts are actually deployed
    try {
      const OracleRegistry = await hre.ethers.getContractFactory("OracleRegistry");
      const oracleRegistry = OracleRegistry.attach(existingOracleRegistry);
      const minStake = await oracleRegistry.MIN_ORACLE_STAKE();
      console.log("✅ OracleRegistry verified (Min Stake:", hre.ethers.formatEther(minStake), "STT)");
      
      const VerificationAggregator = await hre.ethers.getContractFactory("VerificationAggregator");
      const verificationAggregator = VerificationAggregator.attach(existingVerificationAggregator);
      const consensusThreshold = await verificationAggregator.CONSENSUS_THRESHOLD();
      console.log("✅ VerificationAggregator verified (Consensus Threshold:", consensusThreshold, "oracles)");
      
      console.log("\n🎉 Oracle network is already deployed and working!");
      return;
    } catch (error) {
      console.log("⚠️  Contracts not found on network, deploying fresh...");
    }
  }

  try {
    // 1. Deploy OracleRegistry
    console.log("\n🏗️  Deploying OracleRegistry...");
    const OracleRegistry = await hre.ethers.getContractFactory("OracleRegistry");
    
    // Use a higher nonce to avoid conflicts
    const oracleRegistry = await OracleRegistry.deploy({
      nonce: nonce + 10
    });
    await oracleRegistry.waitForDeployment();
    const oracleRegistryAddress = await oracleRegistry.getAddress();
    console.log("✅ OracleRegistry deployed to:", oracleRegistryAddress);

    // 2. Deploy VerificationAggregator
    console.log("\n🏗️  Deploying VerificationAggregator...");
    const commitRegistryAddress = deployment.contracts?.CommitRegistry || process.env.COMMIT_REGISTRY;
    
    if (!commitRegistryAddress) {
      throw new Error("CommitRegistry address not found. Deploy main contracts first.");
    }
    
    console.log("📋 Using CommitRegistry:", commitRegistryAddress);
    
    const VerificationAggregator = await hre.ethers.getContractFactory("VerificationAggregator");
    const verificationAggregator = await VerificationAggregator.deploy(
      oracleRegistryAddress,
      commitRegistryAddress,
      {
        nonce: nonce + 11
      }
    );
    await verificationAggregator.waitForDeployment();
    const aggregatorAddress = await verificationAggregator.getAddress();
    console.log("✅ VerificationAggregator deployed to:", aggregatorAddress);

    // 3. Set VerificationAggregator in OracleRegistry
    console.log("\n🔗 Linking contracts...");
    const setAggregatorTx = await oracleRegistry.setVerificationAggregator(aggregatorAddress, {
      nonce: nonce + 12
    });
    await setAggregatorTx.wait();
    console.log("✅ VerificationAggregator set in OracleRegistry");

    // 4. Set EscrowManager in VerificationAggregator
    console.log("\n🔗 Setting EscrowManager in VerificationAggregator...");
    const escrowManagerAddress = deployment.contracts?.EscrowManager || process.env.ESCROW_MANAGER;
    if (escrowManagerAddress) {
      const setEscrowTx = await verificationAggregator.setEscrowManager(escrowManagerAddress, {
        nonce: nonce + 13
      });
      await setEscrowTx.wait();
      console.log("✅ EscrowManager set in VerificationAggregator");
    } else {
      console.warn("⚠️  EscrowManager address not found, skipping integration");
    }

    // 5. Set VerificationAggregator in CommitRegistry
    console.log("\n🔗 Updating CommitRegistry...");
    const CommitRegistry = await hre.ethers.getContractFactory("CommitRegistry");
    const commitRegistry = CommitRegistry.attach(commitRegistryAddress);
    
    try {
      const setAggregatorInCommitTx = await commitRegistry.setVerificationAggregator(aggregatorAddress, {
        nonce: nonce + 14
      });
      await setAggregatorInCommitTx.wait();
      console.log("✅ VerificationAggregator set in CommitRegistry");
    } catch (error) {
      console.warn("⚠️  Could not set aggregator in CommitRegistry (may need owner access):", error.message);
    }

    // 6. Update deployment file
    deployment.oracleRegistry = oracleRegistryAddress;
    deployment.verificationAggregator = aggregatorAddress;
    deployment.oracleDeployedAt = new Date().toISOString();
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\n💾 Deployment config updated");

    // 7. Display summary
    console.log("\n📊 Oracle Network Deployment Summary");
    console.log("=".repeat(50));
    console.log("OracleRegistry:           ", oracleRegistryAddress);
    console.log("VerificationAggregator:   ", aggregatorAddress);
    console.log("CommitRegistry (linked):  ", commitRegistryAddress);
    console.log("EscrowManager (linked):   ", escrowManagerAddress || "Not found");
    
    // 8. Display next steps
    console.log("\n📝 Next Steps:");
    console.log("1. Update .env.local with:");
    console.log(`   ORACLE_REGISTRY=${oracleRegistryAddress}`);
    console.log(`   VERIFICATION_AGGREGATOR=${aggregatorAddress}`);
    console.log(`   NEXT_PUBLIC_ORACLE_REGISTRY=${oracleRegistryAddress}`);
    console.log(`   NEXT_PUBLIC_VERIFICATION_AGGREGATOR=${aggregatorAddress}`);
    console.log("\n2. Update frontend config (lib/somnia-config.ts)");
    console.log("\n3. Register oracle nodes:");
    console.log("   cd backend/agents && npm run register:oracles");
    console.log("\n4. Start oracle nodes:");
    console.log("   cd backend/agents && npm run start:autonomous");

    // 9. Verify oracle registry configuration
    console.log("\n🔍 Verifying Oracle Registry...");
    const minStake = await oracleRegistry.MIN_ORACLE_STAKE();
    const minOracles = await oracleRegistry.MIN_ORACLES_FOR_CONSENSUS();
    console.log(`   Minimum Stake: ${hre.ethers.formatEther(minStake)} STT`);
    console.log(`   Minimum Oracles for Consensus: ${minOracles}`);

    // 10. Verify aggregator configuration
    console.log("\n🔍 Verifying Verification Aggregator...");
    const consensusThreshold = await verificationAggregator.CONSENSUS_THRESHOLD();
    const submissionWindow = await verificationAggregator.SUBMISSION_WINDOW();
    console.log(`   Consensus Threshold: ${consensusThreshold} oracles`);
    console.log(`   Submission Window: ${submissionWindow} seconds (${Number(submissionWindow) / 60} minutes)`);

    console.log("\n✅ Oracle network infrastructure deployed successfully!");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
