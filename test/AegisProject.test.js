import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "ethers";

// ─── Constants ───────────────────────────────────────────────────────
const ONE_ETH = parseEther("1");
const FIVE_ETH = parseEther("5");
const TEN_ETH = parseEther("10");

// ─── Tests ───────────────────────────────────────────────────────────
describe("Aegis Crowdfunding Platform", function () {
  let factory, owner, creator, backer1, backer2, backer3;
  let connection, ethers;

  beforeEach(async function () {
    connection = await hre.network.connect();
    ethers = connection.ethers;

    [owner, creator, backer1, backer2, backer3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AegisCrowdfundFactory");
    factory = await Factory.deploy();
  });

  afterEach(async function () {
    await connection.close();
  });

  async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }

  async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  async function createSampleProject(goal) {
    if (!goal) goal = TEN_ETH;
    const now = await latestTimestamp();
    const fundingDeadline = now + 30 * 24 * 3600;
    const m1Deadline = fundingDeadline + 30 * 24 * 3600;
    const m2Deadline = m1Deadline + 30 * 24 * 3600;
    const m3Deadline = m2Deadline + 30 * 24 * 3600;

    const half = goal / 2n;
    const quarter = goal / 4n;

    const tx = await factory.connect(creator).createProject({
      name: "Test Project",
      description: "A test crowdfunding project",
      fundingGoal: goal,
      fundingDeadline: fundingDeadline,
      mDescriptions: ["Milestone 1", "Milestone 2", "Milestone 3"],
      mAmounts: [half, quarter, quarter],
      mDeadlines: [m1Deadline, m2Deadline, m3Deadline],
    });

    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => {
      try {
        return factory.interface.parseLog(log)?.name === "ProjectCreated";
      } catch {
        return false;
      }
    });
    const parsed = factory.interface.parseLog(event);
    const projectAddr = parsed.args.projectAddress;
    const Project = await ethers.getContractFactory("AegisProject");
    return Project.attach(projectAddr);
  }

  describe("Factory", function () {
    it("should create a project and track it", async function () {
      const project = await createSampleProject();
      expect(await factory.getProjectCount()).to.equal(1);
      const projects = await factory.getProjects();
      expect(projects[0]).to.equal(await project.getAddress());
    });

    it("should track projects by creator", async function () {
      await createSampleProject();
      await createSampleProject();
      const creatorProjects = await factory.getProjectsByCreator(creator.address);
      expect(creatorProjects.length).to.equal(2);
    });
  });

  describe("Contributions", function () {
    it("should accept contributions", async function () {
      const project = await createSampleProject();
      await project.connect(backer1).contribute({ value: ONE_ETH });
      expect(await project.contributions(backer1.address)).to.equal(ONE_ETH);
      expect(await project.totalFunded()).to.equal(ONE_ETH);
    });

    it("should auto-activate when goal reached", async function () {
      const project = await createSampleProject();
      await project.connect(backer1).contribute({ value: FIVE_ETH });
      await project.connect(backer2).contribute({ value: FIVE_ETH });
      expect(await project.state()).to.equal(1);
    });

    it("should reject contributions after deadline", async function () {
      const project = await createSampleProject();
      await increaseTime(31 * 24 * 3600);
      await expect(
        project.connect(backer1).contribute({ value: ONE_ETH })
      ).to.be.revertedWith("Funding period ended");
    });
  });

  describe("Milestone Workflow", function () {
    let project;

    beforeEach(async function () {
      project = await createSampleProject();
      await project.connect(backer1).contribute({ value: FIVE_ETH });
      await project.connect(backer2).contribute({ value: FIVE_ETH });
    });

    it("should allow creator to submit milestone report", async function () {
      await project.connect(creator).submitMilestoneReport(0, "Progress report for M1");
      const milestones = await project.getMilestones();
      expect(milestones.statuses[0]).to.equal(1);
      expect(milestones.reportURIs[0]).to.equal("Progress report for M1");
    });

    it("should allow backers to vote on milestone", async function () {
      await project.connect(creator).submitMilestoneReport(0, "Report");
      await project.connect(backer1).voteOnMilestone(0, true);
      await project.connect(backer2).voteOnMilestone(0, true);
      const milestones = await project.getMilestones();
      expect(milestones.yesVotesArr[0]).to.equal(TEN_ETH);
    });

    it("should prevent double voting", async function () {
      await project.connect(creator).submitMilestoneReport(0, "Report");
      await project.connect(backer1).voteOnMilestone(0, true);
      await expect(
        project.connect(backer1).voteOnMilestone(0, true)
      ).to.be.revertedWith("Already voted");
    });

    it("should release funds on approved milestone", async function () {
      await project.connect(creator).submitMilestoneReport(0, "Report");
      await project.connect(backer1).voteOnMilestone(0, true);
      await project.connect(backer2).voteOnMilestone(0, true);
      await increaseTime(8 * 24 * 3600);
      const balBefore = await ethers.provider.getBalance(creator.address);
      await project.finalizeMilestone(0);
      const balAfter = await ethers.provider.getBalance(creator.address);
      expect(balAfter).to.be.gt(balBefore);
      const milestones = await project.getMilestones();
      expect(milestones.statuses[0]).to.equal(2);
    });

    it("should reject milestone with majority no votes", async function () {
      await project.connect(creator).submitMilestoneReport(0, "Report");
      await project.connect(backer1).voteOnMilestone(0, false);
      await project.connect(backer2).voteOnMilestone(0, false);
      await increaseTime(8 * 24 * 3600);
      await project.finalizeMilestone(0);
      const milestones = await project.getMilestones();
      expect(milestones.statuses[0]).to.equal(3);
    });
  });

  describe("Refunds", function () {
    it("should allow refund if funding deadline passes", async function () {
      const project = await createSampleProject();
      await project.connect(backer1).contribute({ value: ONE_ETH });
      await increaseTime(31 * 24 * 3600);
      const balBefore = await ethers.provider.getBalance(backer1.address);
      await project.connect(backer1).claimRefund();
      const balAfter = await ethers.provider.getBalance(backer1.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should allow refund after project cancellation", async function () {
      const project = await createSampleProject();
      await project.connect(backer1).contribute({ value: FIVE_ETH });
      await project.connect(backer2).contribute({ value: FIVE_ETH });
      await project.connect(creator).cancelProject();
      const balBefore = await ethers.provider.getBalance(backer1.address);
      await project.connect(backer1).claimRefund();
      const balAfter = await ethers.provider.getBalance(backer1.address);
      expect(balAfter).to.be.gt(balBefore);
    });
  });

  describe("Project Completion", function () {
    it("should mark project as completed when all milestones approved", async function () {
      const project = await createSampleProject();
      await project.connect(backer1).contribute({ value: FIVE_ETH });
      await project.connect(backer2).contribute({ value: FIVE_ETH });
      for (let i = 0; i < 3; i++) {
        await project.connect(creator).submitMilestoneReport(i, `Report ${i}`);
        await project.connect(backer1).voteOnMilestone(i, true);
        await project.connect(backer2).voteOnMilestone(i, true);
        await increaseTime(8 * 24 * 3600);
        await project.finalizeMilestone(i);
      }
      expect(await project.state()).to.equal(2);
    });
  });
});