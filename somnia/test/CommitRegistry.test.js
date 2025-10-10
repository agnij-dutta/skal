const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommitRegistry", function () {
  let commitRegistry;
  let owner;
  let provider;
  let buyer;

  beforeEach(async function () {
    [owner, provider, buyer] = await ethers.getSigners();

    const CommitRegistryFactory = await ethers.getContractFactory("CommitRegistry");
    commitRegistry = await CommitRegistryFactory.deploy();
    await commitRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await commitRegistry.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct constants", async function () {
      expect(await commitRegistry.COMMIT_WINDOW()).to.equal(3600); // 1 hour
      expect(await commitRegistry.REVEAL_WINDOW()).to.equal(86400); // 24 hours
      expect(await commitRegistry.MIN_STAKE()).to.equal(ethers.parseEther("0.01"));
    });
  });

  describe("Commit Task", function () {
    it("Should allow committing a task", async function () {
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      const marketId = 1;
      const stake = ethers.parseEther("0.1");

      await expect(
        commitRegistry.connect(provider).commitTask(commitHash, marketId, stake, {
          value: stake
        })
      )
        .to.emit(commitRegistry, "TaskCommitted");

      const task = await commitRegistry.getTask(0);
      expect(task.commitHash).to.equal(commitHash);
      expect(task.provider).to.equal(provider.address);
      expect(task.marketId).to.equal(marketId);
      expect(task.stake).to.equal(stake);
      expect(task.state).to.equal(0); // Committed state
    });

    it("Should reject commit with insufficient stake", async function () {
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      const marketId = 1;
      const stake = ethers.parseEther("0.005"); // Less than MIN_STAKE

      await expect(
        commitRegistry.connect(provider).commitTask(commitHash, marketId, stake, {
          value: stake
        })
      ).to.be.revertedWith("Insufficient stake");
    });

    it("Should reject commit with zero commit hash", async function () {
      const marketId = 1;
      const stake = ethers.parseEther("0.1");

      await expect(
        commitRegistry.connect(provider).commitTask(ethers.ZeroHash, marketId, stake, {
          value: stake
        })
      ).to.be.revertedWith("Invalid commit hash");
    });
  });

  describe("Reveal Task", function () {
    beforeEach(async function () {
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      const marketId = 1;
      const stake = ethers.parseEther("0.1");

      await commitRegistry.connect(provider).commitTask(commitHash, marketId, stake, {
        value: stake
      });
    });

    it("Should allow revealing a task", async function () {
      const taskId = 0;
      const cid = "QmTestCID123";

      await expect(
        commitRegistry.connect(provider).revealTask(taskId, cid)
      )
        .to.emit(commitRegistry, "TaskRevealed");

      const task = await commitRegistry.getTask(taskId);
      expect(task.cid).to.equal(cid);
      expect(task.state).to.equal(1); // Revealed state
    });

    it("Should reject reveal by non-provider", async function () {
      const taskId = 0;
      const cid = "QmTestCID123";

      await expect(
        commitRegistry.connect(buyer).revealTask(taskId, cid)
      ).to.be.revertedWith("Only provider can reveal");
    });
  });
});
