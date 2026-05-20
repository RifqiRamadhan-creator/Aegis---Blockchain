import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import TokenPanel from "../components/TokenPanel";
import { fmtEth, fmtDate, stateBadge, shortAddr } from "../utils/formatters";

export default function Home() {
  const { factory, getProjectContract, account } = useWeb3();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!factory) return;
    loadProjects();
  }, [factory]);

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

  if (!account) {
    return <p className="text-muted text-center mt-1">Connect your wallet to view projects.</p>;
  }
  if (!factory) {
    return <p className="error text-center mt-1">Factory contract not configured. Set VITE_FACTORY_ADDRESS in .env</p>;
  }

  return (
    <div>
      <TokenPanel title="Aegis Token Dashboard" />
      <div className="flex-between mb-1">
        <h1>All Projects</h1>
        <button onClick={loadProjects} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {projects.length === 0 && !loading && (
        <p className="text-muted">No projects yet. <Link to="/create">Create one</Link>.</p>
      )}

      {projects.map((p) => {
        const { label, cls } = stateBadge(p.state);
        const pct = p.goal > 0n ? Number((p.funded * 100n) / p.goal) : 0;
        return (
          <Link to={`/project/${p.address}`} key={p.address} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <div className="flex-between">
                <h3>{p.name}</h3>
                <span className={`badge ${cls}`}>{label}</span>
              </div>
              <p className="text-sm text-muted" style={{ margin: "0.25rem 0" }}>{p.description}</p>
              <div className="flex-between text-sm">
                <span>{fmtEth(p.funded)} / {fmtEth(p.goal)} ETH ({pct}%)</span>
                <span className="text-muted">by {shortAddr(p.creator)}</span>
              </div>
              <div className="text-sm text-muted">
                Deadline: {fmtDate(p.deadline)} · {Number(p.milestoneCount)} milestones
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
