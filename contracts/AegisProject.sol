// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IVotesToken {
    function getPastVotes(address account, uint256 timepoint) external view returns (uint256);
    function getPastTotalSupply(uint256 timepoint) external view returns (uint256);
}

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
        uint256 snapshotBlock;
    }

    /// @dev Used to avoid stack-too-deep in constructor
    struct MilestoneParams {
        string[] descriptions;
        uint256[] amounts;
        uint256[] deadlines;
    }

    // ──────────────────────────── State ────────────────────────────
    
    IVotesToken public immutable governanceToken;
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

    modifier inState(ProjectState _state) {
        require(state == _state, "Invalid project state");
        _;
    }

    // ──────────────────────────── Constructor ──────────────────────

    constructor(
        address _governanceToken,
        address _creator,
        string memory _name,
        string memory _description,
        uint256 _fundingGoal,
        uint256 _fundingDeadline,
        string[] memory _mDescriptions,
        uint256[] memory _mAmounts,
        uint256[] memory _mDeadlines
    ) {
        require(_governanceToken != address(0), "Invalid token address");
        governanceToken = IVotesToken(_governanceToken);
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
                votingDeadline: 0,
                snapshotBlock: 0
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
        m.snapshotBlock = block.number;

        emit MilestoneSubmitted(_milestoneId, _reportURI);
    }

    function voteOnMilestone(uint256 _milestoneId, bool _approve)
        external
        // onlyBacker
        inState(ProjectState.Active)
    {
        require(_milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[_milestoneId];
        require(m.status == MilestoneStatus.Submitted, "Voting not open");
        require(block.timestamp <= m.votingDeadline, "Voting period ended");
        require(!hasVoted[msg.sender][_milestoneId], "Already voted");

        hasVoted[msg.sender][_milestoneId] = true;
        // uint256 weight = contributions[msg.sender];
        uint256 weight = governanceToken.getPastVotes(msg.sender, m.snapshotBlock);
        require(weight > 0, "No voting power at snapshot");

        if (_approve) {
            m.yesVotes += weight;
        } else {
            m.noVotes += weight;
        }

        emit VoteCast(_milestoneId, msg.sender, _approve, weight);

        // Auto-finalize when majority is reached (enables instant payout
        // in single-backer demo scenarios)
        uint256 tokenSupplyAtSnapshot = governanceToken.getPastTotalSupply(m.snapshotBlock);
        uint256 majority = tokenSupplyAtSnapshot / 2;

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

    /**
     * @dev Internal helper — approves a milestone and releases its funds.
     *      Called both by auto-finalize (majority reached) and manual
     *      finalizeMilestone (voting deadline passed).
     */
    function _approveMilestone(uint256 _milestoneId) internal {
        Milestone storage m = milestones[_milestoneId];
        // Guard: prevent double-release if already approved
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

    function claimRefund() external {
        require(contributions[msg.sender] > 0, "Only backers with contributions");
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

    /**
     * @notice Returns core milestone data (descriptions, amounts, deadlines, statuses, reportURIs).
     */
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

    function getBackers() external view returns (address[] memory) {
        return backers;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getProjectSummary()
        external
        view
        returns (
            address _creator,
            string memory _name,
            string memory _description,
            uint256 _fundingGoal,
            uint256 _fundingDeadline,
            uint256 _totalFunded,
            ProjectState _state,
            uint256 _milestoneCount,
            uint256 _totalReleased
        )
    {
        return (
            creator,
            name,
            description,
            fundingGoal,
            fundingDeadline,
            totalFunded,
            state,
            milestones.length,
            totalReleased
        );
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