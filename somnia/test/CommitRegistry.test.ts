import { expect } from "chai";
import { ethers } from "hardhat";
import { CommitRegistry } from "../typechain-types";

describe("CommitRegistry", function () {
  let commitRegistry: CommitRegistry;
  let owner: any;
  let provider: any;
  let buyer: any;

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
        .to.emit(commitRegistry, "TaskCommitted")
        .withArgs(0, commitHash, provider.address, marketId, stake, await ethers.provider.getBlock("latest").then(b => b!.timestamp));

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
        .to.emit(commitRegistry, "TaskRevealed")
        .withArgs(taskId, cid, await ethers.provider.getBlock("latest").then(b => b!.timestamp));

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

    it("Should reject reveal after deadline", async function () {
      const taskId = 0;
      const cid = "QmTestCID123";

      // Fast forward past reveal deadline
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine", []);

      await expect(
        commitRegistry.connect(provider).revealTask(taskId, cid)
      ).to.be.revertedWith("Reveal deadline passed");
    });
  });

  describe("Validation", function () {
    beforeEach(async function () {
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      const marketId = 1;
      const stake = ethers.parseEther("0.1");

      await commitRegistry.connect(provider).commitTask(commitHash, marketId, stake, {
        value: stake
      });

      const cid = "QmTestCID123";
      await commitRegistry.connect(provider).revealTask(0, cid);
    });

    it("Should allow validation", async function () {
      const taskId = 0;
      const score = 85;
      const verifier = owner.address;
      const signature = "0x1234";

      await expect(
        commitRegistry.connect(owner).finalizeValidation(taskId, score, verifier, signature)
      )
        .to.emit(commitRegistry, "TaskValidated")
        .withArgs(taskId, score, verifier, await ethers.provider.getBlock("latest").then(b => b!.timestamp));

      const task = await commitRegistry.getTask(taskId);
      expect(task.validationScore).to.equal(score);
      expect(task.verifier).to.equal(verifier);
      expect(task.state).to.equal(2); // Validated state
    });

    it("Should reject validation with invalid score", async function () {
      const taskId = 0;
      const score = 150; // Invalid score > 100
      const verifier = owner.address;
      const signature = "0x1234";

      await expect(
        commitRegistry.connect(owner).finalizeValidation(taskId, score, verifier, signature)
      ).to.be.revertedWith("Invalid score");
    });
  });
});
