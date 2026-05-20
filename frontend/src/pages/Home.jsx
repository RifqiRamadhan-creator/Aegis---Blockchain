import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, fmtDate, stateBadge, shortAddr } from "../utils/formatters";

const STATE_FILTERS = [
  { key: "all", label: "All" },
  { key: "0", label: "Funding" },
  { key: "1", label: "Active" },
  { key: "2", label: "Completed" },
  { key: "3", label: "Cancelled" },
];

export default function Home() {
  const { factory, getProjectContract, account } = useWeb3();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!factory) return;
    loadProjects();
  }, [factory]);

  // Redirect unauthenticated users to landing page
  useEffect(() => {
    if (!account) navigate("/landing", { replace: true });
  }, [account]);

  async function loadProjects() {
    setLoading(true);
    try {
      const addrs = await factory.getProjects();
      const list = [];
      for (const addr of addrs) {
        const c = getProjectContract(addr);
        const s = await c.getProjectSummary();
        list.push({
          address: addr,
          creator: s._creator,
          name: s._name,
          description: s._description,
          goal: s._fundingGoal,
          deadline: s._fundingDeadline,
          funded: s._totalFunded,
          state: s._state,
          milestoneCount: s._milestoneCount,
          released: s._totalReleased,
        });
      }
      setProjects(list);
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
    setLoading(false);
  }

  if (!factory) {
    return (
      <div className="connect-prompt">
        <span className="prompt-icon">⚠️</span>
        <p>Factory contract not configured. Set VITE_FACTORY_ADDRESS in .env</p>
      </div>
    );
  }

  // Filter + search
  const filtered = projects.filter((p) => {
    const matchState = filter === "all" || String(Number(p.state)) === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q);
    return matchState && matchSearch;
  });

  return (
    <div>
      <div className="hero">
        <h1><span className="gradient-text">Discover Projects</span></h1>
        <p>Fund innovative ideas with ETH. Track milestones. Vote on progress.</p>
      </div>

      {/* Search + Refresh */}
      <div className="home-toolbar">
        <div className="search-bar-wrap">
          <span className="search-icon">🔍</span>
          <input
            id="project-search"
            className="search-input"
            type="text"
            placeholder="Search projects by name, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
        <button className="btn-secondary" onClick={loadProjects} disabled={loading} id="refresh-projects">
          {loading && <span className="loading-spinner" style={{ width: 14, height: 14, marginRight: 4 }} />}
          {loading ? "Loading…" : "⟳ Refresh"}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {STATE_FILTERS.map((f) => {
          const count = f.key === "all"
            ? projects.length
            : projects.filter((p) => String(Number(p.state)) === f.key).length;
          return (
            <button
              key={f.key}
              id={`filter-${f.key}`}
              className={`filter-tab ${filter === f.key ? "filter-tab-active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="filter-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Skeletons */}
      {loading && filtered.length === 0 && (
        <>
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-icon">{search ? "🔎" : "📭"}</div>
          <p>
            {search
              ? `No projects matched "${search}".`
              : filter !== "all"
              ? `No ${STATE_FILTERS.find((f) => f.key === filter)?.label} projects.`
              : "No projects yet."}
          </p>
          {!search && filter === "all" && (
            <Link to="/create">
              <button className="btn-shimmer">Create First Project</button>
            </Link>
          )}
          {(search || filter !== "all") && (
            <button
              className="btn-secondary"
              style={{ marginTop: "0.75rem" }}
              onClick={() => { setSearch(""); setFilter("all"); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Project Cards */}
      {filtered.map((p, i) => {
        const { label, cls } = stateBadge(p.state);
        const pct = p.goal > 0n ? Number((p.funded * 100n) / p.goal) : 0;
        return (
          <Link
            to={`/project/${p.address}`}
            key={p.address}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="project-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex-between">
                <h3 className="project-name">{p.name}</h3>
                <span className={`badge ${cls}`}>{label}</span>
              </div>
              <p className="project-desc">{p.description}</p>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="project-stats">
                <span>
                  {fmtEth(p.funded)} / {fmtEth(p.goal)} ETH{" "}
                  <span className="text-muted">({pct}%)</span>
                </span>
                <span className="creator-tag">{shortAddr(p.creator)}</span>
              </div>
              <div className="project-meta">
                <span>📅 {fmtDate(p.deadline)}</span>
                <span>🎯 {Number(p.milestoneCount)} milestones</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
