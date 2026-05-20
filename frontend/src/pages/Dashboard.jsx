import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, fmtDate, stateBadge, shortAddr } from "../utils/formatters";
import { Contract } from "ethers";
import ProjectABI from "../../../artifacts/contracts/AegisProject.sol/AegisProject.json";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, delay }) {
  return (
    <div className="dash-stat-card" style={{ animationDelay: delay }}>
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-body">
        <div className="dash-stat-value gradient-text">{value}</div>
        <div className="dash-stat-label">{label}</div>
        {sub && <div className="dash-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Mini Project Card ────────────────────────────────────────────────────────
function MiniProjectCard({ p, idx }) {
  const { label, cls } = stateBadge(p.state);
  const pct = p.goal > 0n ? Number((p.funded * 100n) / p.goal) : 0;
  return (
    <Link
      to={`/project/${p.address}`}
      className="mini-project-card"
      style={{ animationDelay: `${idx * 0.07}s` }}
    >
      <div className="mini-card-top">
        <span className="mini-card-name">{p.name}</span>
        <span className={`badge ${cls}`}>{label}</span>
      </div>
      <p className="mini-card-desc">{p.description}</p>
      <div className="progress-bar-track" style={{ margin: "0.5rem 0" }}>
        <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="mini-card-meta">
        <span>{fmtEth(p.funded)} / {fmtEth(p.goal)} ETH</span>
        <span className="text-muted">{pct}%</span>
      </div>
      {p.myContribution !== undefined && p.myContribution > 0n && (
        <div className="mini-card-contribution">
          💎 You backed {fmtEth(p.myContribution)} ETH
        </div>
      )}
      <div className="mini-card-footer">
        <span>📅 {fmtDate(p.deadline)}</span>
        <span>🎯 {Number(p.milestoneCount)} milestones</span>
      </div>
    </Link>
  );
}

// ─── Empty panel ──────────────────────────────────────────────────────────────
function EmptyPanel({ icon, message, cta, to }) {
  return (
    <div className="dash-empty">
      <span className="dash-empty-icon">{icon}</span>
      <p>{message}</p>
      {cta && (
        <Link to={to}>
          <button className="btn-shimmer" style={{ marginTop: "0.75rem" }}>{cta}</button>
        </Link>
      )}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function Tab({ active, onClick, children, count }) {
  return (
    <button
      className={`dash-tab ${active ? "dash-tab-active" : ""}`}
      onClick={onClick}
    >
      {children}
      {count !== undefined && (
        <span className="dash-tab-badge">{count}</span>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { factory, getProjectContract, account, provider, signer } = useWeb3();
  const [created, setCreated] = useState([]);
  const [backed, setBacked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("created");

  useEffect(() => {
    if (factory && account) loadDashboard();
  }, [factory, account]);

  async function loadDashboard() {
    setLoading(true);
    try {
      await Promise.all([loadCreated(), loadBacked()]);
    } catch (e) {
      console.error("Dashboard load error:", e);
    }
    setLoading(false);
  }

  async function loadCreated() {
    try {
      const addrs = await factory.getProjectsByCreator(account);
      const list = [];
      for (const addr of addrs) {
        try {
          const c = getProjectContract(addr);
          const s = await c.getProjectSummary();
          list.push({
            address: addr,
            name: s._name,
            description: s._description,
            goal: s._fundingGoal,
            deadline: s._fundingDeadline,
            funded: s._totalFunded,
            state: s._state,
            milestoneCount: s._milestoneCount,
            released: s._totalReleased,
          });
        } catch { /* skip */ }
      }
      setCreated(list);
    } catch (e) {
      console.error("loadCreated error:", e);
    }
  }

  async function loadBacked() {
    try {
      const allAddrs = await factory.getProjects();
      const list = [];
      for (const addr of allAddrs) {
        try {
          // Use a read-only contract (no signer needed for view)
          const c = signer
            ? new Contract(addr, ProjectABI.abi, signer)
            : new Contract(addr, ProjectABI.abi, provider);
          const myContrib = await c.contributions(account);
          if (myContrib > 0n) {
            const s = await c.getProjectSummary();
            list.push({
              address: addr,
              name: s._name,
              description: s._description,
              goal: s._fundingGoal,
              deadline: s._fundingDeadline,
              funded: s._totalFunded,
              state: s._state,
              milestoneCount: s._milestoneCount,
              released: s._totalReleased,
              myContribution: myContrib,
            });
          }
        } catch { /* skip */ }
      }
      setBacked(list);
    } catch (e) {
      console.error("loadBacked error:", e);
    }
  }

  // ── Guard: no wallet ───────────────────────────────────────────────────────
  if (!account) {
    return (
      <div className="connect-prompt">
        <span className="prompt-icon">🔗</span>
        <p>Connect your wallet to view your dashboard.</p>
      </div>
    );
  }

  if (!factory) {
    return (
      <div className="connect-prompt">
        <span className="prompt-icon">⚠️</span>
        <p>Factory contract not configured. Set VITE_FACTORY_ADDRESS in .env</p>
      </div>
    );
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalContributed = backed.reduce((sum, p) => sum + (p.myContribution || 0n), 0n);
  const activeBacked = backed.filter(p => Number(p.state) === 1).length;
  const activeCreated = created.filter(p => Number(p.state) <= 1).length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1><span className="gradient-text">My Dashboard</span></h1>
        <p className="subtitle">
          Welcome back,{" "}
          <span className="text-accent" style={{ fontWeight: 600 }}>
            {shortAddr(account)}
          </span>
          {" "}— here's your Aegis activity.
        </p>
      </div>

      {/* Stats Row */}
      <div className="dash-stats-row">
        <StatCard
          icon="🚀"
          label="Projects Created"
          value={created.length}
          sub={activeCreated > 0 ? `${activeCreated} active` : undefined}
          delay="0s"
        />
        <StatCard
          icon="💎"
          label="Projects Backed"
          value={backed.length}
          sub={activeBacked > 0 ? `${activeBacked} active` : undefined}
          delay="0.08s"
        />
        <StatCard
          icon="💰"
          label="Total Contributed"
          value={`${fmtEth(totalContributed)} ETH`}
          delay="0.16s"
        />
        <StatCard
          icon="🏆"
          label="Completed Projects"
          value={[...created, ...backed].filter(p => Number(p.state) === 2).length}
          delay="0.24s"
        />
      </div>

      {/* Tabs */}
      <div className="dash-tabs">
        <Tab active={activeTab === "created"} onClick={() => setActiveTab("created")} count={created.length}>
          🚀 My Projects
        </Tab>
        <Tab active={activeTab === "backed"} onClick={() => setActiveTab("backed")} count={backed.length}>
          💎 Projects I Backed
        </Tab>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div>
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      )}

      {/* Tab Content */}
      {!loading && activeTab === "created" && (
        <>
          <div className="dash-tab-header">
            <span className="text-muted text-sm">{created.length} project{created.length !== 1 ? "s" : ""} created</span>
            <Link to="/create">
              <button className="btn-shimmer" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                + New Project
              </button>
            </Link>
          </div>
          {created.length === 0 ? (
            <EmptyPanel
              icon="🛠️"
              message="You haven't created any projects yet."
              cta="🚀 Create Your First Project"
              to="/create"
            />
          ) : (
            <div className="mini-project-grid">
              {created.map((p, i) => (
                <MiniProjectCard key={p.address} p={p} idx={i} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && activeTab === "backed" && (
        <>
          <div className="dash-tab-header">
            <span className="text-muted text-sm">{backed.length} project{backed.length !== 1 ? "s" : ""} backed</span>
            <Link to="/">
              <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                🔍 Explore More
              </button>
            </Link>
          </div>
          {backed.length === 0 ? (
            <EmptyPanel
              icon="💎"
              message="You haven't backed any projects yet."
              cta="🔍 Explore Projects"
              to="/"
            />
          ) : (
            <div className="mini-project-grid">
              {backed.map((p, i) => (
                <MiniProjectCard key={p.address} p={p} idx={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
