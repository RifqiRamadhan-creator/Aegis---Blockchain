# Aegis: Crowdfunding Platform Appendix

This appendix contains supplementary materials for the paper *Aegis: Milestone-Based Crowdfunding on Ethereum with Contribution-Weighted Voting*.

## 🔗 Links and Resources

* **GitHub Repository (Source Code)**: [https://github.com/RifqiRamadhan-creator/Aegis---Blockchain](https://github.com/RifqiRamadhan-creator/Aegis---Blockchain)
* **Product Demo Video**: *Upcoming* (Under preparation)

## 📸 System Screenshots and Interface Mockups

Below are the screenshots illustrating the user interface design, dashboard, and transaction workflow of the Aegis platform.

### 1. Interface Mockup
This mockup illustrates the main crowdfunding landing page, showcasing campaign progress tracking, active milestones, and contributing interfaces.

![Aegis Interface Mockup](photos/mockup-antarmuka.png)

### 2. User Dashboard
The dashboard displays creator statistics, active milestones, release summaries, and the contract balance of deployed campaigns.

![Aegis User Dashboard](photos/screenshot-dashboard.png)

### 3. Transaction Workflow
This screenshot displays MetaMask transaction confirmations and status logging for contribution-weighted voting and milestone fund releases.

![Aegis Transaction Workflow](photos/screenshot-transaksi.png)

---

## 💻 Source Code Listing

This section contains the core files from the project repository, including the Solidity smart contracts, Mocha unit tests, and Hardhat configuration.

### 1. AegisCrowdfundFactory.sol
This factory contract is responsible for deploying new instance-isolated `AegisProject` contracts on-chain and tracking them in a registry.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./AegisProject.sol";

/**
 * @title AegisCrowdfundFactory
 * @author Aegis Platform
 * @notice Factory contract that deploys and tracks AegisProject instances.
 * @dev Allows anyone to create a new crowdfunding project with milestones.
 */
contract AegisCrowdfundFactory {
    // ──────────────────────────── State ────────────────────────────

    /// @notice Array of all deployed project addresses
    address[] public projects;

    /// @notice Mapping from creator address to their project addresses
    mapping(address => address[]) public creatorProjects;

    // ──────────────────────────── Events ───────────────────────────

    event ProjectCreated(
        address indexed projectAddress,
        address indexed creator,
        string name,
        uint256 fundingGoal,
        uint256 fundingDeadline
    );

    // ──────────────────────────── Structs ──────────────────────────

    /// @notice Parameters for creating a new project (avoids stack-too-deep)
    struct CreateProjectParams {
        string name;
        string description;
        uint256 fundingGoal;
        uint256 fundingDeadline;
        string[] mDescriptions;
        uint256[] mAmounts;
        uint256[] mDeadlines;
    }

    // ──────────────────────────── Functions ────────────────────────

    /**
     * @notice Create a new crowdfunding project with milestones.
     * @param params  Struct containing all project creation parameters
     * @return projectAddress  Address of the newly deployed AegisProject contract
     */
    function createProject(CreateProjectParams calldata params)
        external
        returns (address projectAddress)
    {
        AegisProject project = new AegisProject(
            msg.sender,
            params.name,
            params.description,
            params.fundingGoal,
            params.fundingDeadline,
            params.mDescriptions,
            params.mAmounts,
            params.mDeadlines
        );

        projectAddress = address(project);
        projects.push(projectAddress);
        creatorProjects[msg.sender].push(projectAddress);

        emit ProjectCreated(
            projectAddress,
            msg.sender,
            params.name,
            params.fundingGoal,
            params.fundingDeadline
        );
    }

    /**
     * @notice Get all deployed project addresses.
     */
    function getProjects() external view returns (address[] memory) {
        return projects;
    }

    /**
     * @notice Get total number of projects created.
     */
    function getProjectCount() external view returns (uint256) {
        return projects.length;
    }

    /**
     * @notice Get all project addresses created by a specific creator.
     * @param _creator Creator address
     */
    function getProjectsByCreator(address _creator) external view returns (address[] memory) {
        return creatorProjects[_creator];
    }
}
```

### 2. AegisProject.sol
This is the core smart contract representing an individual crowdfunding project. It handles contributions, milestone reporting, contribution-weighted voting, milestone finalizations, and refunds.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title AegisProject
 * @author Aegis Platform
 * @notice Individual crowdfunding project with milestone-based fund release.
 * @dev Each project goes through: Funding → Active → Completed/Cancelled.
 *      Funds are locked and released per-milestone after backer approval votes.
 */
contract AegisProject {
    // ──────────────────────────── Enums ────────────────────────────

    enum ProjectState {
        Funding,    // Accepting contributions
        Active,     // Funded — milestones in progress
        Completed,  // All milestones delivered
        Cancelled   // Project cancelled — refunds available
    }

    enum MilestoneStatus {
        Pending,    // Not yet submitted
        Submitted,  // Report submitted, voting open
        Approved,   // Majority voted yes — funds released
        Rejected    // Majority voted no
    }

    // ──────────────────────────── Structs ──────────────────────────

    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;
        MilestoneStatus status;
        string reportURI;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votingDeadline;
    }

    /// @dev Used to avoid stack-too-deep in constructor
    struct MilestoneParams {
        string[] descriptions;
        uint256[] amounts;
        uint256[] deadlines;
    }

    // ──────────────────────────── State ────────────────────────────

    address public creator;
    string public name;
    string public description;
    uint256 public fundingGoal;
    uint256 public fundingDeadline;
    uint256 public totalFunded;
    ProjectState public state;

    Milestone[] public milestones;

    mapping(address => uint256) public contributions;
    mapping(address => mapping(uint256 => bool)) public hasVoted;

    address[] public backers;
    mapping(address => bool) private isBacker;

    uint256 public totalReleased;

    uint256 public constant VOTING_PERIOD = 7 days;

    // ──────────────────────────── Events ───────────────────────────

    event Contributed(address indexed backer, uint256 amount);
    event ProjectActivated();
    event MilestoneSubmitted(uint256 indexed milestoneId, string reportURI);
    event VoteCast(uint256 indexed milestoneId, address indexed voter, bool approve, uint256 weight);
    event MilestoneApproved(uint256 indexed milestoneId, uint256 amount);
    event MilestoneRejected(uint256 indexed milestoneId);
    event FundsReleased(uint256 indexed milestoneId, uint256 amount);
    event RefundClaimed(address indexed backer, uint256 amount);
    event ProjectCancelled();
    event ProjectCompleted();

    // ──────────────────────────── Modifiers ────────────────────────

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    modifier onlyBacker() {
        require(contributions[msg.sender] > 0, "Only backers");
        _;
    }

    modifier inState(ProjectState _state) {
        require(state == _state, "Invalid project state");
        _;
    }

    // ──────────────────────────── Constructor ──────────────────────

    constructor(
        address _creator,
        string memory _name,
        string memory _description,
        uint256 _fundingGoal,
        uint256 _fundingDeadline,
        string[] memory _mDescriptions,
        uint256[] memory _mAmounts,
        uint256[] memory _mDeadlines
    ) {
        require(_creator != address(0), "Invalid creator");
        require(_fundingGoal > 0, "Goal must be > 0");
        require(_fundingDeadline > block.timestamp, "Deadline must be in the future");
        require(
            _mDescriptions.length == _mAmounts.length &&
            _mAmounts.length == _mDeadlines.length &&
            _mDescriptions.length > 0,
            "Invalid milestone data"
        );

        creator = _creator;
        name = _name;
        description = _description;
        fundingGoal = _fundingGoal;
        fundingDeadline = _fundingDeadline;
        state = ProjectState.Funding;

        // Validate and push milestones in a separate internal call
        // to keep constructor stack depth low
        _initMilestones(
            MilestoneParams({
                descriptions: _mDescriptions,
                amounts: _mAmounts,
                deadlines: _mDeadlines
            }),
            _fundingGoal
        );
    }

    function _initMilestones(MilestoneParams memory p, uint256 _fundingGoal) internal {
        uint256 total;
        for (uint256 i = 0; i < p.amounts.length; i++) {
            require(p.amounts[i] > 0, "Milestone amount must be > 0");
            total += p.amounts[i];
        }
        require(total == _fundingGoal, "Milestone amounts must equal goal");

        for (uint256 i = 0; i < p.descriptions.length; i++) {
            milestones.push(Milestone({
                description: p.descriptions[i],
                amount: p.amounts[i],
                deadline: p.deadlines[i],
                status: MilestoneStatus.Pending,
                reportURI: "",
                yesVotes: 0,
                noVotes: 0,
                votingDeadline: 0
            }));
        }
    }

    // ──────────────────────────── Funding ──────────────────────────

    function contribute() external payable inState(ProjectState.Funding) {
        require(block.timestamp <= fundingDeadline, "Funding period ended");
        require(msg.value > 0, "Must send ETH");

        if (!isBacker[msg.sender]) {
            backers.push(msg.sender);
            isBacker[msg.sender] = true;
        }

        contributions[msg.sender] += msg.value;
        totalFunded += msg.value;

        emit Contributed(msg.sender, msg.value);

        if (totalFunded >= fundingGoal) {
            state = ProjectState.Active;
            emit ProjectActivated();
        }
    }

    // ──────────────────────────── Milestones ───────────────────────

    function submitMilestoneReport(uint256 _milestoneId, string calldata _reportURI)
        external
        onlyCreator
        inState(ProjectState.Active)
    {
        require(_milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[_milestoneId];
        require(m.status == MilestoneStatus.Pending, "Milestone not pending");

        m.reportURI = _reportURI;
        m.status = MilestoneStatus.Submitted;
        m.votingDeadline = block.timestamp + VOTING_PERIOD;

        emit MilestoneSubmitted(_milestoneId, _reportURI);
    }

    function voteOnMilestone(uint256 _milestoneId, bool _approve)
        external
        onlyBacker
        inState(ProjectState.Active)
    {
        require(_milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[_milestoneId];
        require(m.status == MilestoneStatus.Submitted, "Voting not open");
        require(block.timestamp <= m.votingDeadline, "Voting period ended");
        require(!hasVoted[msg.sender][_milestoneId], "Already voted");

        hasVoted[msg.sender][_milestoneId] = true;
        uint256 weight = contributions[msg.sender];

        if (_approve) {
            m.yesVotes += weight;
        } else {
            m.noVotes += weight;
        }

        emit VoteCast(_milestoneId, msg.sender, _approve, weight);

        // Auto-finalize when majority is reached
        uint256 majority = totalFunded / 2;
        if (m.yesVotes > majority) {
            _approveMilestone(_milestoneId);
        } else if (m.noVotes > majority) {
            m.status = MilestoneStatus.Rejected;
            emit MilestoneRejected(_milestoneId);
        }
    }

    function finalizeMilestone(uint256 _milestoneId)
        external
        inState(ProjectState.Active)
    {
        require(_milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[_milestoneId];
        require(m.status == MilestoneStatus.Submitted, "Not submitted");
        require(block.timestamp > m.votingDeadline, "Voting still active");

        if (m.yesVotes > m.noVotes) {
            _approveMilestone(_milestoneId);
        } else {
            m.status = MilestoneStatus.Rejected;
            emit MilestoneRejected(_milestoneId);
        }
    }

    function _approveMilestone(uint256 _milestoneId) internal {
        Milestone storage m = milestones[_milestoneId];
        require(m.status == MilestoneStatus.Submitted, "Already finalized");

        m.status = MilestoneStatus.Approved;
        uint256 amt = m.amount;
        totalReleased += amt;

        (bool sent, ) = payable(creator).call{value: amt}("");
        require(sent, "Transfer failed");

        emit MilestoneApproved(_milestoneId, amt);
        emit FundsReleased(_milestoneId, amt);

        _checkCompletion();
    }

    // ──────────────────────────── Refunds ──────────────────────────

    function claimRefund() external onlyBacker {
        require(
            state == ProjectState.Cancelled ||
            (state == ProjectState.Funding && block.timestamp > fundingDeadline),
            "Refund not available"
        );

        uint256 contribution = contributions[msg.sender];
        require(contribution > 0, "Nothing to refund");

        uint256 refundAmount;
        if (state == ProjectState.Funding) {
            refundAmount = contribution;
        } else {
            uint256 remaining = address(this).balance;
            uint256 pool = totalFunded - totalReleased;
            refundAmount = pool > 0 ? (contribution * remaining) / pool : 0;
            if (refundAmount > remaining) refundAmount = remaining;
        }

        contributions[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: refundAmount}("");
        require(sent, "Refund transfer failed");

        emit RefundClaimed(msg.sender, refundAmount);
    }

    function cancelProject() external {
        require(
            state == ProjectState.Active || state == ProjectState.Funding,
            "Cannot cancel"
        );

        if (msg.sender != creator) {
            bool hasRejected = false;
            for (uint256 i = 0; i < milestones.length; i++) {
                if (milestones[i].status == MilestoneStatus.Rejected) {
                    hasRejected = true;
                    break;
                }
            }
            require(hasRejected, "Only creator can cancel without rejection");
        }

        state = ProjectState.Cancelled;
        emit ProjectCancelled();
    }

    // ──────────────────────────── Views ────────────────────────────

    function getMilestones()
        external
        view
        returns (
            string[] memory descriptions,
            uint256[] memory amounts,
            uint256[] memory deadlines,
            MilestoneStatus[] memory statuses,
            string[] memory reportURIs,
            uint256[] memory yesVotesArr,
            uint256[] memory noVotesArr,
            uint256[] memory votingDeadlines
        )
    {
        uint256 len = milestones.length;
        descriptions    = new string[](len);
        amounts         = new uint256[](len);
        deadlines       = new uint256[](len);
        statuses        = new MilestoneStatus[](len);
        reportURIs      = new string[](len);
        yesVotesArr     = new uint256[](len);
        noVotesArr      = new uint256[](len);
        votingDeadlines = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            _fillMilestone(
                i,
                descriptions,
                amounts,
                deadlines,
                statuses,
                reportURIs,
                yesVotesArr,
                noVotesArr,
                votingDeadlines
            );
        }
    }

    function _fillMilestone(
        uint256 i,
        string[] memory descriptions,
        uint256[] memory amounts,
        uint256[] memory deadlines,
        MilestoneStatus[] memory statuses,
        string[] memory reportURIs,
        uint256[] memory yesVotesArr,
        uint256[] memory noVotesArr,
        uint256[] memory votingDeadlines
    ) internal view {
        Milestone storage m = milestones[i];
        descriptions[i]    = m.description;
        amounts[i]         = m.amount;
        deadlines[i]       = m.deadline;
        statuses[i]        = m.status;
        reportURIs[i]      = m.reportURI;
        yesVotesArr[i]     = m.yesVotes;
        noVotesArr[i]      = m.noVotes;
        votingDeadlines[i] = m.votingDeadline;
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    // ──────────────────────────── Internal ─────────────────────────

    function _checkCompletion() internal {
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestones[i].status != MilestoneStatus.Approved) return;
        }
        state = ProjectState.Completed;
        emit ProjectCompleted();
    }

    receive() external payable {
        revert("Use contribute()");
    }
}
```

### 3. AegisProject.test.js
This test script verifies the functionality of the smart contract suite. It covers unit testing for project instantiation, funding milestones, contribution-weighted voting, milestone approvals, and refund claims on Hardhat local network.

```javascript
import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "ethers";

const ONE_ETH = parseEther("1");
const FIVE_ETH = parseEther("5");
const TEN_ETH = parseEther("10");

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
```

### 4. hardhat.config.js
The configuration file specifying network configurations, EDR simulator accounts (with pre-allocated Ether to demonstrate the milestone releases), and Solidity version profile optimizations.

```javascript
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const compilerSettings = {
  optimizer: {
    enabled: true,
    runs: 200,
  },
  viaIR: true,
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  networks: {
    hardhat: {
      type: "edr-simulated",
      accounts: [
        { privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", balance: "1000000000000000000000" },
        { privateKey: "0x59c6995e998f97a5a0044d65f29d37a8abf7e1ee202e6d11b3323055d76e894c", balance: "10000000000000000000000" },
        { privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", balance: "10000000000000000000000" },
        { privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", balance: "10000000000000000000000" },
        { privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", balance: "10000000000000000000000" },
        { privateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", balance: "10000000000000000000000" },
        { privateKey: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", balance: "10000000000000000000000" },
        { privateKey: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", balance: "10000000000000000000000" },
        { privateKey: "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", balance: "10000000000000000000000" },
        { privateKey: "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6", balance: "10000000000000000000000" },
        { privateKey: "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897", balance: "10000000000000000000000" },
        { privateKey: "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82", balance: "10000000000000000000000" },
        { privateKey: "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1", balance: "10000000000000000000000" },
        { privateKey: "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd", balance: "10000000000000000000000" },
        { privateKey: "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa", balance: "10000000000000000000000" },
        { privateKey: "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61", balance: "10000000000000000000000" },
        { privateKey: "0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0", balance: "10000000000000000000000" },
        { privateKey: "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd", balance: "10000000000000000000000" },
        { privateKey: "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0", balance: "10000000000000000000000" },
        { privateKey: "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e", balance: "10000000000000000000000" },
      ],
    },
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: compilerSettings,
      },
      production: {
        version: "0.8.28",
        settings: compilerSettings,
      },
    },
    splitTestsCompilation: false,
  },
  paths: {
    tests: {
      mocha: "./test",
    },
  },
  test: {
    mocha: {
      timeout: 40000,
    },
  },
});
```

