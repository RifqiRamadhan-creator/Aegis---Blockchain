import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, fmtDate, stateBadge, shortAddr } from "../utils/formatters";
import { Contract, BrowserProvider } from "ethers";
import ProjectABI from "../../../artifacts/contracts/AegisProject.sol/AegisProject.json";

const STATE_FILTERS = [
  { key: "all", label: "All" },
  { key: "0", label: "Funding" },
  { key: "1", label: "Active" },
  { key: "2", label: "Completed" },
  { key: "3", label: "Cancelled" },
];

const SORT_OPTIONS = [
  { key: "newest", label: "Newest First" },
  { key: "funded", label: "Most Funded" },
  { key: "ending", label: "Ending Soon" },
  { key: "milestones", label: "Most Milestones" },
];

export default function Explore() {
  const { factory, getProjectContract, provider, signer } = useWeb3();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    if (factory) loadProjects();
  }, [factory]);

  async function loadProjects() {
    setLoading(true);
    try {
      const addrs = await factory.getProjects();
      const list = [];
      for (let idx = 0; idx < addrs.length; idx++) {
        try {
          const c = signer
            ? new Contract(addrs[idx], ProjectABI.abi, signer)
            : new Contract(addrs[idx], ProjectABI.abi, provider);
          const s = await c.getProjectSummary();
          list.push({
            address: addrs[idx],
            index: idx,
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
        } catch {}
      }
      setProjects(list);
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let result = projects.filter((p) => {
      const matchState = filter === "all" || String(Number(p.state)) === filter;
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
      return matchState && matchSearch;
    });

    // Sort
    switch (sort) {
      case "funded":
        result = [...result].sort((a, b) => (b.funded > a.funded ? 1 : b.funded < a.funded ? -1 : 0));
        break;
      case "ending":
        result = [...result].sort((a, b) => Number(a.deadline) - Number(b.deadline));
        break;
      case "milestones":
        result = [...result].sort((a, b) => Number(b.milestoneCount) - Number(a.milestoneCount));
        break;
      case "newest":
      default:
        result = [...result].sort((a, b) => b.index - a.index);
        break;
    }
    return result;
  }, [projects, filter, search, sort]);

  if (!factory) {
    return <div className="connect-prompt"><span className="prompt-icon">⚠️</span><p>Connect wallet to explore projects.</p></div>;
  }

  return (
    <div>
      <div className="hero">
        <h1><span className="gradient-text">Explore Projects</span></h1>
        <p>Discover, filter, and sort all crowdfunding projects on the platform.</p>
      </div>

      {/* Toolbar */}
      <div className="explore-toolbar">
        <div className="search-bar-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, description, or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
        <select className="explore-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <button className="btn-secondary" onClick={loadProjects} disabled={loading}>
          {loading ? "Loading…" : "⟳ Refresh"}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {STATE_FILTERS.map((f) => {
          const count = f.key === "all" ? projects.length : projects.filter((p) => String(Number(p.state)) === f.key).length;
          return (
            <button key={f.key} className={`filter-tab ${filter === f.key ? "filter-tab-active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label} <span className="filter-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <div className="explore-results-bar">
        <span className="text-sm text-muted">{filtered.length} project{filtered.length !== 1 ? "s" : ""} found</span>
        {(search || filter !== "all") && (
          <button className="btn-ghost" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
        )}
      </div>

      {/* Loading */}
      {loading && filtered.length === 0 && (
        <div className="explore-grid">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">{search ? "🔎" : "📭"}</div>
          <p>{search ? `No projects matched "${search}".` : filter !== "all" ? "No projects with this status." : "No projects yet."}</p>
        </div>
      )}

      {/* Project Grid */}
      <div className="explore-grid">
        {filtered.map((p, i) => {
          const { label, cls } = stateBadge(p.state);
          const pct = p.goal > 0n ? Number((p.funded * 100n) / p.goal) : 0;
          return (
            <Link to={`/project/${p.address}`} key={p.address} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="project-card" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex-between">
                  <h3 className="project-name">{p.name}</h3>
                  <span className={`badge ${cls}`}>{label}</span>
                </div>
                <p className="project-desc">{p.description}</p>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="project-stats">
                  <span>{fmtEth(p.funded)} / {fmtEth(p.goal)} ETH <span className="text-muted">({pct}%)</span></span>
                  <Link to={`/profile/${p.creator}`} className="creator-tag" onClick={(e) => e.stopPropagation()}>{shortAddr(p.creator)}</Link>
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
    </div>
  );
}
