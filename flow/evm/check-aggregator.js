const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking VerificationAggregator contract...");
  
  const aggregatorAddress = "0xDB49635E5Eb88719A1281CDa32578fA1837297E9";
  
  try {
    // Try to get the contract
    const VerificationAggregator = await hre.ethers.getContractFactory("VerificationAggregator");
    const aggregator = VerificationAggregator.attach(aggregatorAddress);
    
    // Try to read some basic data
    console.log("📋 Contract address:", aggregatorAddress);
    
    const consensusThreshold = await aggregator.CONSENSUS_THRESHOLD();
    console.log("✅ Consensus Threshold:", consensusThreshold.toString());
    
    const submissionWindow = await aggregator.SUBMISSION_WINDOW();
    console.log("✅ Submission Window:", submissionWindow.toString(), "seconds");
    
    // Check if we can call getSubmissionCount for task 153
    const submissionCount = await aggregator.getSubmissionCount(153);
    console.log("✅ Task 153 submission count:", submissionCount.toString());
    
    const hasConsensus = await aggregator.hasConsensus(153);
    console.log("✅ Task 153 has consensus:", hasConsensus);
    
    console.log("\n🎉 VerificationAggregator contract is working!");
    
  } catch (error) {
    console.error("❌ Error checking VerificationAggregator:", error.message);
    
    // Try to check if the address has any code
    const code = await hre.ethers.provider.getCode(aggregatorAddress);
    if (code === "0x") {
      console.log("❌ No contract code found at address - contract not deployed");
    } else {
      console.log("✅ Contract code found, but method calls failed");
      console.log("Code length:", code.length);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
