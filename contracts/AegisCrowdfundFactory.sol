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

    /// @notice The global governance token address used for all project voting weights
    address public immutable governanceToken;

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

    // ──────────────────────────── Constructor ──────────────────────

    constructor(address _governanceToken) {
        require(_governanceToken != address(0), "Invalid token address");
        governanceToken = _governanceToken;
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
            governanceToken,
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
