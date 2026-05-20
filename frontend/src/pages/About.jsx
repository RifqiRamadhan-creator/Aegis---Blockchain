import { useState } from "react";
import { Link } from "react-router-dom";

// ── FAQ accordion item ────────────────────────────────────────────────────────
function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? "faq-open" : ""}`}>
      <button className="faq-question" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <span className="faq-chevron">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="faq-answer">{answer}</div>}
    </div>
  );
}

// ── Lifecycle step ────────────────────────────────────────────────────────────
function LifecycleStep({ state, color, icon, title, desc, isLast }) {
  return (
    <div className="lifecycle-row">
      <div className="lifecycle-left">
        <div className="lifecycle-dot" style={{ background: color, boxShadow: `0 0 16px ${color}55` }}>
          {icon}
        </div>
        {!isLast && <div className="lifecycle-line" />}
      </div>
      <div className="lifecycle-content">
        <div className="lifecycle-badge" style={{ color, borderColor: `${color}44`, background: `${color}11` }}>
          {state}
        </div>
        <h3 className="lifecycle-title">{title}</h3>
        <p className="lifecycle-desc">{desc}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function About() {
  return (
    <div className="about-page">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <h1><span className="gradient-text">About Aegis</span></h1>
        <p className="subtitle">
          A trustless, milestone-based crowdfunding platform built on Ethereum.
        </p>
      </div>

      {/* ── What is Aegis ──────────────────────────────────────────── */}
      <div className="about-card">
        <div className="about-card-icon">⛨</div>
        <div>
          <h2>What is Aegis?</h2>
          <p className="about-text">
            Aegis is a decentralized crowdfunding protocol where all funds are
            locked in smart contracts and released incrementally as project
            creators hit verifiable milestones — approved by the backers who
            funded them.
          </p>
          <p className="about-text">
            Unlike traditional crowdfunding platforms, Aegis removes the need
            for trust. The rules are written in Solidity and enforced by the
            Ethereum network — no platform can freeze funds, take fees, or
            change the terms.
          </p>
        </div>
      </div>

      {/* ── Project Lifecycle ──────────────────────────────────────── */}
      <section className="about-section">
        <h2 className="about-section-title">
          <span className="gradient-text">Project Lifecycle</span>
        </h2>
        <p className="about-section-sub">
          Every project on Aegis passes through these states:
        </p>

        <div className="lifecycle-timeline">
          <LifecycleStep
            state="Funding"
            color="#818cf8"
            icon="💎"
            title="Funding Phase"
            desc="The project is open for contributions. Any wallet can send ETH. Once the funding goal is reached, the contract automatically transitions to Active. If the deadline passes without reaching the goal, backers can claim full refunds."
          />
          <LifecycleStep
            state="Active"
            color="#34d399"
            icon="🔨"
            title="Active — Milestones in Progress"
            desc="The project is fully funded. Creators submit proof of work for each milestone (URLs, images, videos). Backers then vote — weighted by their ETH contribution. If the majority approves, funds for that milestone are released to the creator instantly."
          />
          <LifecycleStep
            state="Completed"
            color="#c084fc"
            icon="🏆"
            title="Completed"
            desc="All milestones have been approved and funds released. The project is finished. A record of every vote and proof remains permanently on-chain."
          />
          <LifecycleStep
            state="Cancelled"
            color="#fb7185"
            icon="❌"
            title="Cancelled"
            desc="A project can be cancelled by the creator at any time, or by any backer if a milestone has been rejected. Once cancelled, remaining funds are proportionally refunded to all backers."
            isLast
          />
        </div>
      </section>

      {/* ── Milestone System ───────────────────────────────────────── */}
      <section className="about-section">
        <h2 className="about-section-title">
          <span className="gradient-text">Milestone System</span>
        </h2>

        <div className="milestone-explainer-grid">
          <div className="explainer-card">
            <div className="explainer-icon">📋</div>
            <h3>Defined Up-Front</h3>
            <p>Milestones are set at project creation with a description, ETH amount, and deadline. The sum of all milestone amounts must equal the funding goal.</p>
          </div>
          <div className="explainer-card">
            <div className="explainer-icon">📎</div>
            <h3>Proof Submission</h3>
            <p>When a creator completes a milestone, they submit proof — URLs to demos, images of deliverables, or video walkthroughs — stored on-chain.</p>
          </div>
          <div className="explainer-card">
            <div className="explainer-icon">🗳️</div>
            <h3>Backer Voting</h3>
            <p>Backers have 7 days to vote Yes or No. Each vote carries weight equal to their ETH contribution. If &gt;50% of total funded ETH votes Yes, the milestone is approved.</p>
          </div>
          <div className="explainer-card">
            <div className="explainer-icon">⚡</div>
            <h3>Instant Release</h3>
            <p>The moment a majority is reached — even mid-voting-period — funds are automatically transferred to the creator's wallet. No manual action needed.</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section className="about-section">
        <h2 className="about-section-title">
          <span className="gradient-text">Frequently Asked Questions</span>
        </h2>

        <div className="faq-list">
          <FAQItem
            question="Do I need an account to use Aegis?"
            answer="No account needed. You only need a Web3 wallet like MetaMask. Your wallet address is your identity on the platform."
          />
          <FAQItem
            question="What network does Aegis run on?"
            answer="Aegis is deployed on an EVM-compatible network. Check the factory address in your .env file to confirm which network is active. It supports any EVM chain (Ethereum mainnet, testnets, local Hardhat nodes)."
          />
          <FAQItem
            question="What happens if a milestone is rejected?"
            answer="If backers reject a milestone, the creator can try again (re-submit a new report). However, any backer — or the creator — may also cancel the project after a rejection, triggering proportional refunds."
          />
          <FAQItem
            question="Can a creator withdraw funds early?"
            answer="No. Funds are locked in the contract and can only be released by a successful milestone vote. Not even the contract deployer can bypass this."
          />
          <FAQItem
            question="What if voting ends with no majority?"
            answer="If the 7-day voting period ends without a clear majority, anyone can call finalizeMilestone. Whichever side (yes or no) has more ETH weight wins."
          />
          <FAQItem
            question="Is the code open source?"
            answer="Yes. The Solidity contracts and frontend are fully open source. You can verify the logic yourself before contributing to any project."
          />
          <FAQItem
            question="Are there platform fees?"
            answer="No. Aegis takes zero fees. The only costs are Ethereum gas fees for transactions, which go directly to network validators."
          />
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <div className="about-cta">
        <h2>Start Building with Aegis</h2>
        <p>Create a project or explore what's already being funded.</p>
        <div className="hero-actions" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
          <Link to="/" className="btn-hero-primary btn-shimmer">
            🔍 Explore Projects
          </Link>
          <Link to="/create" className="btn-hero-secondary">
            🚀 Create a Project
          </Link>
        </div>
      </div>

    </div>
  );
}
