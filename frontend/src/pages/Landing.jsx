import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Contract, formatEther } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import ProjectABI from "../../../artifacts/contracts/AegisProject.sol/AegisProject.json";

// ── Animated counter hook ──────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ── Step card ─────────────────────────────────────────────────────────────
function StepCard({ number, icon, title, desc, delay }) {
  return (
    <div className="step-card" style={{ animationDelay: delay }}>
      <div className="step-number">{number}</div>
      <div className="step-icon">{icon}</div>
      <h3 className="step-title">{title}</h3>
      <p className="step-desc">{desc}</p>
    </div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay }) {
  return (
    <div className="feature-card" style={{ animationDelay: delay }}>
      <div className="feature-icon-wrap">
        <span className="feature-icon">{icon}</span>
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </div>
  );
}

// ── Stat item ─────────────────────────────────────────────────────────────
function StatItem({ value, label, prefix = "", suffix = "" }) {
  return (
    <div className="hero-stat">
      <span className="hero-stat-value gradient-text">
        {prefix}{value}{suffix}
      </span>
      <span className="hero-stat-label">{label}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Landing() {
  const { factory, account, connect } = useWeb3();
  const [stats, setStats] = useState({ projects: 0, ethRaised: 0n, loaded: false });

  const projectCount = useCountUp(stats.projects, 1000);
  const ethCount = useCountUp(
    stats.loaded ? Math.round(parseFloat(formatEther(stats.ethRaised)) * 100) : 0,
    1200
  );

  useEffect(() => {
    if (factory && !stats.loaded) loadStats();
  }, [factory]);

  async function loadStats() {
    try {
      const addrs = await factory.getProjects();
      let raised = 0n;
      for (const addr of addrs) {
        try {
          const c = new Contract(addr, ProjectABI.abi, factory.runner);
          const s = await c.getProjectSummary();
          raised += s._totalFunded;
        } catch { /* skip */ }
      }
      setStats({ projects: addrs.length, ethRaised: raised, loaded: true });
    } catch { /* silent */ }
  }

  return (
    <div className="landing-page">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        {/* Ambient glows */}
        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />
        <div className="hero-glow hero-glow-bottom" />

        {/* Grid overlay */}
        <div className="hero-grid-overlay" />

        <div className="hero-content">
          <div className="hero-badge" style={{ animationDelay: "0s" }}>
            <span className="hero-badge-dot" />
            Milestone-Based Crowdfunding on Ethereum
          </div>

          <h1 className="hero-title" style={{ animationDelay: "0.1s" }}>
            Fund the Future,
            <br />
            <span className="gradient-text">Milestone by Milestone</span>
          </h1>

          <p className="hero-subtitle" style={{ animationDelay: "0.2s" }}>
            Aegis is a trustless crowdfunding platform where backers vote on each
            milestone before funds are released — keeping creators accountable and
            your ETH protected.
          </p>

          <div className="hero-actions" style={{ animationDelay: "0.3s" }}>
            {account ? (
              <>
                <Link to="/" className="btn-hero-primary btn-shimmer">
                  🚀 Explore Projects
                </Link>
                <Link to="/create" className="btn-hero-secondary">
                  ✦ Create Project
                </Link>
              </>
            ) : (
              <>
                <button
                  className="btn-hero-primary btn-shimmer"
                  onClick={connect}
                  id="landing-connect-wallet"
                >
                  🔗 Connect Wallet
                </button>
                <Link to="/about" className="btn-hero-secondary">
                  Learn More →
                </Link>
              </>
            )}
          </div>

          {/* Stats — always visible with live data when available */}
          <div className="hero-stats" style={{ animationDelay: "0.45s" }}>
            <StatItem
              value={stats.loaded ? projectCount : "—"}
              label="Projects Launched"
            />
            <div className="hero-stat-divider" />
            <StatItem
              value={stats.loaded ? (ethCount / 100).toFixed(2) : "—"}
              suffix=" ETH"
              label="Total Raised"
            />
            <div className="hero-stat-divider" />
            <StatItem value="100%" label="On-Chain" />
            <div className="hero-stat-divider" />
            <StatItem value="0%" label="Platform Fees" />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator" style={{ animationDelay: "1.2s" }}>
          <div className="scroll-dot" />
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="landing-section">
        <div className="section-label">How It Works</div>
        <h2 className="section-title">Three Steps to Trustless Funding</h2>
        <p className="section-subtitle">
          No middlemen. No hidden fees. Just transparent, milestone-gated crowdfunding.
        </p>

        <div className="steps-grid">
          <StepCard
            number="01"
            icon="🛠️"
            title="Create a Project"
            desc="Define your funding goal, deadline, and break your project into milestones with specific deliverables and ETH amounts."
            delay="0s"
          />
          <StepCard
            number="02"
            icon="💎"
            title="Backers Fund It"
            desc="Anyone with ETH can back your project. Funds are locked in the smart contract until milestones are approved."
            delay="0.1s"
          />
          <StepCard
            number="03"
            icon="🗳️"
            title="Vote &amp; Release"
            desc="After each milestone is submitted with proof, backers vote. Majority approval releases funds to the creator automatically."
            delay="0.2s"
          />
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="landing-section landing-section-alt">
        <div className="section-label">Why Aegis</div>
        <h2 className="section-title">Built for Accountability</h2>
        <p className="section-subtitle">
          Every ETH you commit is protected by smart contracts — not promises.
        </p>

        <div className="features-grid">
          <FeatureCard
            icon="🔒"
            title="Funds Stay Locked"
            desc="All ETH is held in an auditable smart contract. Creators can't withdraw until backers approve each milestone."
            delay="0s"
          />
          <FeatureCard
            icon="⚖️"
            title="Vote by Stake"
            desc="Voting weight is proportional to your contribution. Bigger backers have more say — but everyone has a voice."
            delay="0.08s"
          />
          <FeatureCard
            icon="🔍"
            title="Transparent Proofs"
            desc="Creators attach URLs, images, and video to each milestone submission. Everything is visible on-chain."
            delay="0.16s"
          />
          <FeatureCard
            icon="↩️"
            title="Refund Protection"
            desc="If a project is cancelled or the funding deadline passes unfulfilled, backers can claim their ETH back."
            delay="0.24s"
          />
          <FeatureCard
            icon="⚡"
            title="Auto-Finalize"
            desc="Once a majority is reached, funds release instantly — no waiting for someone to manually trigger the payout."
            delay="0.32s"
          />
          <FeatureCard
            icon="🌐"
            title="Fully Decentralized"
            desc="No backend, no database. Everything lives on the Ethereum blockchain, verified by every node."
            delay="0.40s"
          />
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="landing-cta">
        <div className="cta-glow" />
        <div className="cta-inner">
          <div className="cta-badge">Start Today</div>
          <h2 className="cta-title">Ready to Build Something?</h2>
          <p className="cta-subtitle">
            Launch your project today or back the next big idea on Aegis.<br />
            Fully decentralized. Zero platform fees. On Ethereum.
          </p>
          <div className="hero-actions">
            {account ? (
              <Link to="/create" className="btn-hero-primary btn-shimmer">
                🚀 Create a Project
              </Link>
            ) : (
              <button
                className="btn-hero-primary btn-shimmer"
                onClick={connect}
                id="cta-connect-wallet"
              >
                🔗 Connect Wallet to Start
              </button>
            )}
            <Link to="/about" className="btn-hero-secondary">
              📖 Read the Docs
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
