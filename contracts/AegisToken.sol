// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AegisToken
 * @notice Custom utility and governance token for the Aegis Crowdfunding DAO.
 * @dev Inherits ERC20Votes to support historical checkpoint lookups.
 */
contract AegisToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    
    constructor(address initialOwner) 
        ERC20("Aegis Governance Token", "AEGIS") 
        ERC20Permit("Aegis Governance Token")
        Ownable(initialOwner)
    {}

    /**
     * @notice Mints new governance tokens to backers or distributors.
     * @param to The address receiving the tokens.
     * @param amount The amount of tokens to mint (remember 18 decimals).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // ──────────────────────────── Overrides Required by Solidity ────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}