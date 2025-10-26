const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VerificationAggregator", function () {
  let verificationAggregator;
  let oracleRegistry;
  let commitRegistry;
  let owner;
  let oracle1, oracle2, oracle3;
  let taskId = 1;

  beforeEach(async function () {
    [owner, oracle1, oracle2, oracle3] = await ethers.getSigners();

    // Deploy mock contracts for testing
    const OracleRegistry = await ethers.getContractFactory("OracleRegistry");
    oracleRegistry = await OracleRegistry.deploy();
    await oracleRegistry.waitForDeployment();

    // Mock commit registry address
    const mockCommitRegistry = await oracle1.getAddress();

    const VerificationAggregator = await ethers.getContractFactory("VerificationAggregator");
    verificationAggregator = await VerificationAggregator.deploy(
      await oracleRegistry.getAddress(),
      mockCommitRegistry
    );
    await verificationAggregator.waitForDeployment();

    // Set aggregator in oracle registry
    await oracleRegistry.setVerificationAggregator(await verificationAggregator.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct oracle registry", async function () {
      expect(await verificationAggregator.oracleRegistry()).to.equal(await oracleRegistry.getAddress());
    });

    it("Should set the correct commit registry", async function () {
      expect(await verificationAggregator.commitRegistry()).to.equal(await oracle1.getAddress());
    });

    it("Should have correct consensus threshold", async function () {
      expect(await verificationAggregator.CONSENSUS_THRESHOLD()).to.equal(2);
    });

    it("Should have correct submission window", async function () {
      expect(await verificationAggregator.SUBMISSION_WINDOW()).to.equal(5 * 60); // 5 minutes
    });

    it("Should have correct variance tolerance", async function () {
      expect(await verificationAggregator.SCORE_VARIANCE_TOLERANCE()).to.equal(15);
    });
  });

  describe("Verification Submission", function () {
    it("Should allow oracle to submit verification", async function () {
      const score = 85;
      const signature = "0x1234567890abcdef";

      await expect(
        verificationAggregator.connect(oracle1).submitVerification(taskId, score, signature)
      ).to.emit(verificationAggregator, "VerificationSubmitted")
        .withArgs(taskId, await oracle1.getAddress(), score, await getBlockTimestamp());
    });

    it("Should reject invalid score range", async function () {
      const invalidScore = 150;
      const signature = "0x1234567890abcdef";

      await expect(
        verificationAggregator.connect(oracle1).submitVerification(taskId, invalidScore, signature)
      ).to.be.revertedWith("Invalid score range");
    });

    it("Should reject duplicate submission from same oracle", async function () {
      const score = 85;
      const signature = "0x1234567890abcdef";

      await verificationAggregator.connect(oracle1).submitVerification(taskId, score, signature);

      await expect(
        verificationAggregator.connect(oracle1).submitVerification(taskId, score, signature)
      ).to.be.revertedWith("Already submitted for this task");
    });
  });

  describe("Consensus Mechanism", function () {
    it("Should reach consensus with 2 similar scores", async function () {
      const score1 = 85;
      const score2 = 87; // Within 15% variance
      const signature = "0x1234567890abcdef";

      // First submission
      await verificationAggregator.connect(oracle1).submitVerification(taskId, score1, signature);
      
      // Second submission should trigger consensus
      await expect(
        verificationAggregator.connect(oracle2).submitVerification(taskId, score2, signature)
      ).to.emit(verificationAggregator, "ConsensusReached")
        .and.to.emit(verificationAggregator, "TaskFinalized");
    });

    it("Should not reach consensus with divergent scores", async function () {
      const score1 = 85;
      const score2 = 50; // Outside 15% variance
      const signature = "0x1234567890abcdef";

      await verificationAggregator.connect(oracle1).submitVerification(taskId, score1, signature);
      await verificationAggregator.connect(oracle2).submitVerification(taskId, score2, signature);

      expect(await verificationAggregator.hasConsensus(taskId)).to.be.false;
    });

    it("Should require at least 2 submissions for consensus", async function () {
      const score = 85;
      const signature = "0x1234567890abcdef";

      await verificationAggregator.connect(oracle1).submitVerification(taskId, score, signature);

      expect(await verificationAggregator.hasConsensus(taskId)).to.be.false;
      expect(await verificationAggregator.getSubmissionCount(taskId)).to.equal(1);
    });
  });

  describe("Task Status", function () {
    it("Should track submission count correctly", async function () {
      const score = 85;
      const signature = "0x1234567890abcdef";

      expect(await verificationAggregator.getSubmissionCount(taskId)).to.equal(0);

      await verificationAggregator.connect(oracle1).submitVerification(taskId, score, signature);
      expect(await verificationAggregator.getSubmissionCount(taskId)).to.equal(1);

      await verificationAggregator.connect(oracle2).submitVerification(taskId, score, signature);
      expect(await verificationAggregator.getSubmissionCount(taskId)).to.equal(2);
    });

    it("Should track time remaining correctly", async function () {
      const score = 85;
      const signature = "0x1234567890abcdef";

      // Before any submissions
      expect(await verificationAggregator.getTimeRemaining(taskId)).to.equal(5 * 60);

      await verificationAggregator.connect(oracle1).submitVerification(taskId, score, signature);
      
      const timeRemaining = await verificationAggregator.getTimeRemaining(taskId);
      expect(timeRemaining).to.be.lessThan(5 * 60);
      expect(timeRemaining).to.be.greaterThan(0);
    });

    it("Should track finalization status", async function () {
      const score = 85;
      const signature = "0x1234567890abcdef";

      expect(await verificationAggregator.taskFinalized(taskId)).to.be.false;

      await verificationAggregator.connect(oracle1).submitVerification(taskId, score, signature);
      await verificationAggregator.connect(oracle2).submitVerification(taskId, score, signature);

      expect(await verificationAggregator.taskFinalized(taskId)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to update oracle registry", async function () {
      const newOracleRegistry = await oracle2.getAddress();
      await verificationAggregator.setOracleRegistry(newOracleRegistry);
      expect(await verificationAggregator.oracleRegistry()).to.equal(newOracleRegistry);
    });

    it("Should allow owner to update commit registry", async function () {
      const newCommitRegistry = await oracle2.getAddress();
      await verificationAggregator.setCommitRegistry(newCommitRegistry);
      expect(await verificationAggregator.commitRegistry()).to.equal(newCommitRegistry);
    });

    it("Should allow owner to emergency finalize", async function () {
      const finalScore = 90;
      await verificationAggregator.emergencyFinalize(taskId, finalScore);
      
      expect(await verificationAggregator.taskFinalized(taskId)).to.be.true;
      expect(await verificationAggregator.hasConsensus(taskId)).to.be.true;
    });

    it("Should reject non-owner from updating registries", async function () {
      const newOracleRegistry = await oracle2.getAddress();
      await expect(
        verificationAggregator.connect(oracle1).setOracleRegistry(newOracleRegistry)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // Helper function to get current block timestamp
  async function getBlockTimestamp() {
    const block = await ethers.provider.getBlock('latest');
    return block.timestamp;
  }
});
