import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, fmtDate, stateBadge, shortAddr } from "../utils/formatters";

export default function Profile() {
  const { address } = useParams();
  const { factory, getProjectContract, account, provider } = useWeb3();
  const [created, setCreated] = useState([]);
  const [backed, setBacked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("created");
  const [balance, setBalance] = useState(null);

  const isOwnProfile = account && account.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    if (factory) loadProfile();
  }, [factory, address]);

  useEffect(() => {
    if (provider && address) {
      provider.getBalance(address).then(setBalance).catch(() => {});
    }
  }, [provider, address]);

  async function loadProfile() {
    setLoading(true);
    try {
      // Load created projects
      const createdAddrs = await factory.getProjectsByCreator(address);
      const createdList = [];
      for (const addr of createdAddrs) {
        try {
          const c = getProjectContract(addr);
          const s = await c.getProjectSummary();
          createdList.push({
            address: addr, name: s._name, description: s._description,
            goal: s._fundingGoal, funded: s._totalFunded, state: s._state,
            milestoneCount: s._milestoneCount, deadline: s._fundingDeadline,
            released: s._totalReleased,
          });
        } catch {}
      }
      setCreated(createdList);

      // Load backed projects
      const allAddrs = await factory.getProjects();
      const backedList = [];
      for (const addr of allAddrs) {
        try {
          const c = getProjectContract(addr);
          const contrib = await c.contributions(address);
          if (contrib > 0n) {
            const s = await c.getProjectSummary();
            backedList.push({
              address: addr, name: s._name, description: s._description,
              goal: s._fundingGoal, funded: s._totalFunded, state: s._state,
              milestoneCount: s._milestoneCount, deadline: s._fundingDeadline,
              released: s._totalReleased, myContribution: contrib,
            });
          }
        } catch {}
      }
      setBacked(backedList);
    } catch (e) {
      console.error("Profile load error:", e);
    }
    setLoading(false);
  }

  // Generate avatar color from address
  function avatarColor(addr) {
    const hash = parseInt(addr.slice(2, 8), 16);
    const h = hash % 360;
    return `hsl(${h}, 65%, 55%)`;
  }

  if (!factory) {
    return <div className="connect-prompt"><span className="prompt-icon">⚠️</span><p>Connect wallet to view profiles.</p></div>;
  }

  const totalRaised = created.reduce((sum, p) => sum + p.funded, 0n);
  const totalBacked = backed.reduce((sum, p) => sum + (p.myContribution || 0n), 0n);
  const completedCount = created.filter(p => Number(p.state) === 2).length;
  const successRate = created.length > 0 ? Math.round((completedCount / created.length) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="profile-header">
        <div className="profile-avatar" style={{ background: avatarColor(address) }}>
          {address.slice(2, 4).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1><span className="gradient-text">{isOwnProfile ? "My Profile" : "Profile"}</span></h1>
          <div className="profile-address-row">
            <code className="profile-address">{address}</code>
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(address)} title="Copy address">📋</button>
          </div>
          {balance !== null && (
            <p className="text-sm text-muted">Balance: {fmtEth(balance)} ETH</p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <div className="dash-stat-icon">🚀</div>
          <div className="dash-stat-body">
            <div className="dash-stat-value gradient-text">{created.length}</div>
            <div className="dash-stat-label">Projects Created</div>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon">💎</div>
          <div className="dash-stat-body">
            <div className="dash-stat-value gradient-text">{backed.length}</div>
            <div className="dash-stat-label">Projects Backed</div>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon">📊</div>
          <div className="dash-stat-body">
            <div className="dash-stat-value gradient-text">{successRate}%</div>
            <div className="dash-stat-label">Success Rate</div>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon">💰</div>
          <div className="dash-stat-body">
            <div className="dash-stat-value gradient-text">{fmtEth(totalRaised)} ETH</div>
            <div className="dash-stat-label">Total Raised</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dash-tabs">
        <button className={`dash-tab ${activeTab === "created" ? "dash-tab-active" : ""}`} onClick={() => setActiveTab("created")}>
          🚀 Created <span className="dash-tab-badge">{created.length}</span>
        </button>
        <button className={`dash-tab ${activeTab === "backed" ? "dash-tab-active" : ""}`} onClick={() => setActiveTab("backed")}>
          💎 Backed <span className="dash-tab-badge">{backed.length}</span>
        </button>
      </div>

      {loading && (
        <div><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /><div className="skeleton skeleton-card" /></div>
      )}

      {!loading && activeTab === "created" && (
        <>
          {created.length === 0 ? (
            <div className="dash-empty"><span className="dash-empty-icon">🛠️</span><p>No projects created by this address.</p></div>
          ) : (
            <div className="mini-project-grid">
              {created.map((p, i) => {
                const { label, cls } = stateBadge(p.state);
                const pct = p.goal > 0n ? Number((p.funded * 100n) / p.goal) : 0;
                return (
                  <Link to={`/project/${p.address}`} className="mini-project-card" key={p.address} style={{ animationDelay: `${i * 0.07}s` }}>
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
                    <div className="mini-card-footer">
                      <span>📅 {fmtDate(p.deadline)}</span>
                      <span>🎯 {Number(p.milestoneCount)} milestones</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {!loading && activeTab === "backed" && (
        <>
          {backed.length === 0 ? (
            <div className="dash-empty"><span className="dash-empty-icon">💎</span><p>No projects backed by this address.</p></div>
          ) : (
            <div className="mini-project-grid">
              {backed.map((p, i) => {
                const { label, cls } = stateBadge(p.state);
                const pct = p.goal > 0n ? Number((p.funded * 100n) / p.goal) : 0;
                return (
                  <Link to={`/project/${p.address}`} className="mini-project-card" key={p.address} style={{ animationDelay: `${i * 0.07}s` }}>
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
                    {p.myContribution > 0n && (
                      <div className="mini-card-contribution">💎 Backed {fmtEth(p.myContribution)} ETH</div>
                    )}
                    <div className="mini-card-footer">
                      <span>📅 {fmtDate(p.deadline)}</span>
                      <span>🎯 {Number(p.milestoneCount)} milestones</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
