# Aegis — Ethereum Milestone-Based Crowdfunding Platform

A blockchain-based crowdfunding prototype where developers publish projects, backers fund them with ETH, and funds are released on a **milestone basis** after backer approval.

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MetaMask browser extension

### 1. Install Dependencies

```bash
# Root (smart contracts)
npm install

# Frontend
cd frontend && npm install
```

### 2. Start Local Blockchain

```bash
npx hardhat node
```

This starts a local Hardhat node at `http://127.0.0.1:8545` with 20 test accounts, each funded with 10,000 ETH.

### 3. Deploy Contracts

In a new terminal:

```bash
npx hardhat ignition deploy ignition/modules/AegisFactory.js --network localhost
```

Copy the **AegisCrowdfundFactory** deployed address from the output.

### 4. Configure Frontend

Create `frontend/.env`:

```
VITE_FACTORY_ADDRESS=0x_YOUR_FACTORY_ADDRESS_HERE
VITE_TOKEN_ADDRESS=0x_YOUR_AEGIS_TOKEN_ADDRESS_HERE
```

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

### 6. Connect MetaMask

1. Add a custom network in MetaMask:
   - **Network Name**: Hardhat Local
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **Currency**: ETH
2. Import a test account using one of the private keys printed by `npx hardhat node`
3. Connect your wallet in the Aegis UI

## Testing

```bash
npx hardhat test
```

## Architecture

```
Aegis/
├── contracts/
│   ├── AegisProject.sol            # Individual project with milestones
│   └── AegisCrowdfundFactory.sol   # Factory to create new projects
├── test/
│   └── AegisProject.test.js        # Smart contract tests
├── ignition/modules/
│   └── AegisFactory.js             # Deployment module
├── frontend/                        # React + Vite prototype UI
│   └── src/
│       ├── context/Web3Context.jsx  # MetaMask + contract provider
│       ├── pages/Home.jsx           # Project listing
│       ├── pages/CreateProject.jsx  # Create project form
│       └── pages/ProjectDetail.jsx  # Full project interaction
└── hardhat.config.js
```

## Smart Contract Flow

1. **Creator** → `Factory.createProject()` → deploys new `AegisProject`
2. **Backers** → `project.contribute()` → send ETH (auto-activates at goal)
3. **Creator** → `project.submitMilestoneReport()` → opens 7-day voting
4. **Backers** → `project.voteOnMilestone()` → weighted by contribution
5. **Anyone** → `project.finalizeMilestone()` → releases funds if approved
6. **Backers** → `project.claimRefund()` → if cancelled or deadline passed

## License

MIT
