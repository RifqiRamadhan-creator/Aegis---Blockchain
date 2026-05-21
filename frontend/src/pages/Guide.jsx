import { useState } from "react";
import { Link } from "react-router-dom";

function GuideStep({ number, icon, title, children }) {
  return (
    <div className="step-card" style={{ animationDelay: `${(number - 1) * 0.1}s` }}>
      <div className="step-number">Step {number}</div>
      <div className="step-icon">{icon}</div>
      <div className="step-title">{title}</div>
      <div className="step-desc">{children}</div>
    </div>
  );
}

function GlossaryItem({ term, definition }) {
  return (
    <div className="glossary-item">
      <dt className="glossary-term">{term}</dt>
      <dd className="glossary-def">{definition}</dd>
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? "faq-open" : ""}`}>
      <button className="faq-question" onClick={() => setOpen(!open)}>
        {q}
        <span className="faq-chevron" style={{ transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
}

export default function Guide() {
  return (
    <div className="guide-page">
      <div className="page-header" style={{ textAlign: "center" }}>
        <h1><span className="gradient-text">Getting Started Guide</span></h1>
        <p className="subtitle">Everything you need to know to use Aegis — from setting up your wallet to funding projects and voting on milestones.</p>
      </div>

      {/* Getting Started */}
      <div className="about-section">
        <h2 className="about-section-title"><span className="gradient-text">🦊 Setting Up Your Wallet</span></h2>
        <p className="about-section-sub">Before you can interact with Aegis, you need an Ethereum wallet.</p>
        <div className="steps-grid">
          <GuideStep number={1} icon="📥" title="Install MetaMask">
            Visit <a href="https://metamask.io" target="_blank" rel="noopener noreferrer">metamask.io</a> and install the browser extension. Create a new wallet or import an existing one. Save your seed phrase securely.
          </GuideStep>
          <GuideStep number={2} icon="🔗" title="Connect to Aegis">
            Click the "Connect Wallet" button in the top-right corner of the navigation bar. MetaMask will prompt you to approve the connection.
          </GuideStep>
          <GuideStep number={3} icon="💰" title="Get Test ETH">
            If you're on a testnet, get free ETH from a faucet. For mainnet, transfer ETH to your MetaMask wallet from an exchange.
          </GuideStep>
        </div>
      </div>

      {/* How to Fund */}
      <div className="about-section">
        <h2 className="about-section-title"><span className="gradient-text">💎 How to Fund a Project</span></h2>
        <p className="about-section-sub">Support innovative projects by contributing ETH.</p>
        <div className="steps-grid">
          <GuideStep number={1} icon="🔍" title="Browse Projects">
            Visit the <Link to="/explore">Explore</Link> page to discover projects. Use filters and search to find projects that interest you.
          </GuideStep>
          <GuideStep number={2} icon="📖" title="Review Details">
            Click on a project card to see its full details — description, milestones, funding progress, and the creator's track record.
          </GuideStep>
          <GuideStep number={3} icon="💸" title="Contribute ETH">
            Enter the amount you'd like to contribute and click "Fund Project". Confirm the transaction in MetaMask. Your funds are locked in the smart contract.
          </GuideStep>
        </div>
      </div>

      {/* Milestone Voting */}
      <div className="about-section">
        <h2 className="about-section-title"><span className="gradient-text">🗳️ Understanding Milestones & Voting</span></h2>
        <p className="about-section-sub">The core of Aegis: milestone-based fund release with backer governance.</p>
        <div className="milestone-explainer-grid">
          <div className="explainer-card">
            <div className="explainer-icon">⏳</div>
            <h3>Pending</h3>
            <p>The milestone hasn't been submitted yet. The creator is working on deliverables.</p>
          </div>
          <div className="explainer-card">
            <div className="explainer-icon">📋</div>
            <h3>Submitted</h3>
            <p>The creator submitted proof of work (links, images, videos). A 7-day voting period begins.</p>
          </div>
          <div className="explainer-card">
            <div className="explainer-icon">✅</div>
            <h3>Approved</h3>
            <p>Majority of backers (by ETH weight) voted Yes. Funds for this milestone are released to the creator.</p>
          </div>
          <div className="explainer-card">
            <div className="explainer-icon">❌</div>
            <h3>Rejected</h3>
            <p>Majority voted No. The creator can re-submit or the project may be cancelled for refunds.</p>
          </div>
        </div>
      </div>

      {/* For Creators */}
      <div className="about-section">
        <h2 className="about-section-title"><span className="gradient-text">🚀 For Project Creators</span></h2>
        <p className="about-section-sub">Launch your project and receive milestone-based funding.</p>
        <div className="steps-grid">
          <GuideStep number={1} icon="📝" title="Create Your Project">
            Go to <Link to="/create">Create Project</Link>, fill in your project name, description, funding goal, deadline, and define milestones with amounts.
          </GuideStep>
          <GuideStep number={2} icon="📢" title="Get Funded">
            Share your project link. Once your funding goal is met, the project becomes Active and you can start delivering milestones.
          </GuideStep>
          <GuideStep number={3} icon="📎" title="Submit Proof">
            For each milestone, attach proof of your work — URLs, images, videos, or text descriptions. Submit it to start the 7-day voting period.
          </GuideStep>
          <GuideStep number={4} icon="💰" title="Receive Funds">
            If backers approve your milestone, the allocated ETH is automatically sent to your wallet. Complete all milestones to finish the project.
          </GuideStep>
        </div>
      </div>

      {/* Glossary */}
      <div className="about-section">
        <h2 className="about-section-title"><span className="gradient-text">📚 Glossary</span></h2>
        <p className="about-section-sub">Key terms you'll encounter on Aegis.</p>
        <div className="glossary-grid">
          <GlossaryItem term="ETH (Ether)" definition="The native cryptocurrency of the Ethereum blockchain. Used to fund projects and pay gas fees." />
          <GlossaryItem term="Wei" definition="The smallest unit of ETH. 1 ETH = 10^18 Wei. Contract amounts are stored in Wei internally." />
          <GlossaryItem term="Gas Fee" definition="A small transaction fee paid to the Ethereum network for processing your transaction." />
          <GlossaryItem term="Smart Contract" definition="Self-executing code on the blockchain that holds and releases funds based on predefined rules." />
          <GlossaryItem term="Milestone" definition="A project checkpoint. Each milestone has a deliverable, a funding amount, and a deadline." />
          <GlossaryItem term="Weighted Voting" definition="Your vote's power equals your ETH contribution. A backer who contributed 10 ETH has 10x the vote weight of a 1 ETH backer." />
          <GlossaryItem term="Voting Period" definition="A 7-day window after a milestone is submitted during which backers can vote to approve or reject." />
          <GlossaryItem term="DAO Governance" definition="Decentralized Autonomous Organization governance — backers collectively decide on fund releases, not a single authority." />
        </div>
      </div>

      {/* FAQ */}
      <div className="about-section">
        <h2 className="about-section-title"><span className="gradient-text">❓ Common Questions</span></h2>
        <div className="faq-list">
          <FAQItem q="Do I need ETH to browse projects?" a="No. You can explore and read about projects without connecting a wallet. You only need ETH to fund projects or vote on milestones." />
          <FAQItem q="What happens if a project fails to meet its funding goal?" a="If the funding deadline passes without reaching the goal, backers can claim a full refund of their contributions." />
          <FAQItem q="Can the creator take all the money at once?" a="No. Funds are locked in the smart contract and only released milestone by milestone after backer approval votes." />
          <FAQItem q="What if I contributed but disagree with a milestone?" a='You can vote "Reject" on any submitted milestone. If the majority (by ETH weight) rejects, the milestone fails.' />
          <FAQItem q="How do I get a refund?" a="If a project is cancelled or fails to fund, go to the project page and click 'Claim Refund'. Your proportional share will be returned." />
        </div>
      </div>

      {/* CTA */}
      <div className="about-cta">
        <h2><span className="gradient-text">Ready to Start?</span></h2>
        <p className="text-muted" style={{ marginBottom: "1.5rem" }}>Explore projects or create your own crowdfunding campaign.</p>
        <div className="flex" style={{ gap: "0.75rem", justifyContent: "center" }}>
          <Link to="/explore"><button className="btn-shimmer">🔍 Explore Projects</button></Link>
          <Link to="/create"><button className="btn-secondary">🚀 Create Project</button></Link>
        </div>
      </div>
    </div>
  );
}
