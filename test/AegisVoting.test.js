import { expect } from "chai";
import hre from "hardhat";

describe("AegisProject DAO - Temporal Snapshot Security", function () {
  let ethers;
  let networkConnection;

  let token;
  let project;
  
  let owner;
  let creator;
  let alice;
  let bob;

  let ownerAddress;
  let creatorAddress;
  let aliceAddress;
  let bobAddress;

  beforeEach(async function () {
    networkConnection = await hre.network.create();
    ethers = networkConnection.ethers; 

    [owner, creator, alice, bob] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    creatorAddress = await creator.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();

    // 1. Deploy the Governance Token
    const TokenFactory = await ethers.getContractFactory("AegisToken");
    token = await TokenFactory.deploy(ownerAddress);
    await token.waitForDeployment();

    // 2. Setup mock milestone parameters
    const descriptions = ["Milestone 1: Prototype", "Milestone 2: Mainnet"];
    const amounts = [ethers.parseEther("4"), ethers.parseEther("6")]; 
    
    const latestBlock = await ethers.provider.getBlock("latest");
    const currentTimestamp = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
    
    const fundingDeadline = currentTimestamp + 30 * 24 * 60 * 60; 
    const deadlines = [
      currentTimestamp + 60 * 24 * 60 * 60,
      currentTimestamp + 120 * 24 * 60 * 60
    ];

    // 3. Deploy the Aegis Project
    const ProjectFactory = await ethers.getContractFactory("AegisProject");
    project = await ProjectFactory.deploy(
      await token.getAddress(),
      creatorAddress,
      "Decentralized Web Platform",
      "Building next-gen hosting tools.",
      ethers.parseEther("10"), 
      fundingDeadline,
      descriptions,
      amounts,
      deadlines
    );
    await project.waitForDeployment();

    // 4. Distribute tokens to users
    await token.connect(owner).mint(aliceAddress, ethers.parseEther("1000"));
    await token.connect(owner).mint(bobAddress, ethers.parseEther("1000"));

    // Activate voting checkpoints by self-delegating
    await token.connect(alice).delegate(aliceAddress);
    await token.connect(bob).delegate(bobAddress);
  });

  it("Should prevent double-voting vulnerability by querying past checkpoint blocks", async function () {
    // --- Step A: Complete the Crowdfunding Pool Stage ---
    await project.connect(alice).contribute({ value: ethers.parseEther("10") });
    expect(await project.state()).to.equal(1); 

    // --- Step B: Creator Submits a Milestone Report ---
    const tx = await project.connect(creator).submitMilestoneReport(0, "ipfs://milestone1-report");
    const receipt = await tx.wait();
    const snapshotBlockNumber = receipt.blockNumber;

    await networkConnection.provider.send("evm_increaseTime", [3600]);
    await networkConnection.provider.send("hardhat_mine", ["0x1"]);

    // --- Step C: Alice Casts a Valid Vote ---
    // Alice votes with 1000. Total supply is 2000, majority is 1000. 
    // 1000 is NOT strictly greater than 1000, so the vote remains open!
    await project.connect(alice).voteOnMilestone(0, true);

    const milestoneBefore = await project.milestones(0);
    expect(milestoneBefore.yesVotes).to.equal(ethers.parseEther("1000"));
    expect(milestoneBefore.status).to.equal(1); // 1 = Submitted (Still Open)

    // --- Step D: The Attack Transfer Vector ---
    // Alice attempts to pass her tokens to a completely fresh attacker address 
    // that had 0 tokens at the snapshot block.
    const maliciousAttacker = (await ethers.getSigners())[4]; // Fresh random wallet
    const attackerAddress = await maliciousAttacker.getAddress();
    
    // Self-delegate the fresh wallet to turn on its tracking
    await token.connect(maliciousAttacker).delegate(attackerAddress);
    
    // Transfer the tokens to the fresh wallet
    await token.connect(alice).transfer(attackerAddress, ethers.parseEther("1000"));
    await networkConnection.provider.send("hardhat_mine", ["0x1"]);

    // Confirm the fresh wallet has a current balance but 0 snapshot power
    expect(await token.balanceOf(attackerAddress)).to.equal(ethers.parseEther("1000"));
    const attackerPastWeight = await token.getPastVotes(attackerAddress, snapshotBlockNumber);
    expect(attackerPastWeight).to.equal(0n);

    // --- Step E: Execution Attempt Assertions ---
    // The fresh wallet attempts to double-vote with the transferred tokens
    await expect(
      project.connect(maliciousAttacker).voteOnMilestone(0, true)
    ).to.be.revertedWith("No voting power at snapshot");
  });
});