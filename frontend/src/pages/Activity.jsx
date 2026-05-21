import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, shortAddr } from "../utils/formatters";
import { Contract } from "ethers";
import ProjectABI from "../../../artifacts/contracts/AegisProject.sol/AegisProject.json";

const EVENT_CONFIG = {
  Contributed: { icon: "💰", color: "var(--color-funding)" },
  MilestoneSubmitted: { icon: "📋", color: "var(--color-submitted)" },
  MilestoneApproved: { icon: "✅", color: "var(--color-approved)" },
  MilestoneRejected: { icon: "❌", color: "var(--color-rejected)" },
  ProjectActivated: { icon: "🚀", color: "var(--color-active)" },
  ProjectCancelled: { icon: "🛑", color: "var(--color-cancelled)" },
  ProjectCompleted: { icon: "🏆", color: "var(--color-completed)" },
  FundsReleased: { icon: "💸", color: "var(--color-approved)" },
  RefundClaimed: { icon: "↩️", color: "var(--text-accent)" },
};

function formatEvent(event, projectName) {
  const { name, args, address } = event;
  switch (name) {
    case "Contributed":
      return `${shortAddr(args.backer)} funded ${projectName} with ${fmtEth(args.amount)} ETH`;
    case "MilestoneSubmitted":
      return `Milestone #${Number(args.milestoneId) + 1} submitted for ${projectName}`;
    case "MilestoneApproved":
      return `Milestone #${Number(args.milestoneId) + 1} approved — ${fmtEth(args.amount)} ETH released`;
    case "MilestoneRejected":
      return `Milestone #${Number(args.milestoneId) + 1} rejected on ${projectName}`;
    case "ProjectActivated":
      return `${projectName} is now fully funded!`;
    case "ProjectCancelled":
      return `${projectName} was cancelled`;
    case "ProjectCompleted":
      return `${projectName} completed all milestones!`;
    case "FundsReleased":
      return `${fmtEth(args.amount)} ETH released for milestone #${Number(args.milestoneId) + 1} on ${projectName}`;
    case "RefundClaimed":
      return `${shortAddr(args.backer)} claimed ${fmtEth(args.amount)} ETH refund from ${projectName}`;
    default:
      return `Event on ${projectName}`;
  }
}

export default function Activity() {
  const { factory, provider, signer } = useWeb3();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blockRange, setBlockRange] = useState(500);

  useEffect(() => {
    if (factory && provider) loadActivity();
  }, [factory, provider, blockRange]);

  async function loadActivity() {
    setLoading(true);
    try {
      const addrs = await factory.getProjects();
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - blockRange);
      const allEvents = [];

      for (const addr of addrs) {
        try {
          const c = new Contract(addr, ProjectABI.abi, signer || provider);
          let projectName;
          try {
            projectName = await c.name();
          } catch {
            projectName = shortAddr(addr);
          }

          // Query all events from the contract
          const eventNames = [
            "Contributed", "MilestoneSubmitted", "MilestoneApproved",
            "MilestoneRejected", "ProjectActivated", "ProjectCancelled",
            "ProjectCompleted", "FundsReleased", "RefundClaimed",
          ];

          for (const evtName of eventNames) {
            try {
              const filter = c.filters[evtName]();
              const logs = await c.queryFilter(filter, fromBlock, currentBlock);
              for (const log of logs) {
                allEvents.push({
                  name: evtName,
                  args: log.args,
                  address: addr,
                  projectName,
                  blockNumber: log.blockNumber,
                  transactionHash: log.transactionHash,
                });
              }
            } catch {}
          }
        } catch {}
      }

      // Sort by block number descending (newest first)
      allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
      setEvents(allEvents);
    } catch (e) {
      console.error("Activity load error:", e);
    }
    setLoading(false);
  }

  if (!factory) {
    return <div className="connect-prompt"><span className="prompt-icon">⚠️</span><p>Connect wallet to view activity.</p></div>;
  }

  return (
    <div>
      <div className="page-header" style={{ textAlign: "center" }}>
        <h1><span className="gradient-text">Activity Feed</span></h1>
        <p className="subtitle">Real-time on-chain events across all Aegis projects.</p>
      </div>

      {/* Controls */}
      <div className="activity-controls">
        <span className="text-sm text-muted">{events.length} events found (last {blockRange} blocks)</span>
        <div className="flex" style={{ gap: "0.5rem" }}>
          <button className="btn-secondary" onClick={() => setBlockRange(prev => prev + 500)} disabled={loading}>
            Load More
          </button>
          <button className="btn-secondary" onClick={loadActivity} disabled={loading}>
            {loading ? "Loading…" : "⟳ Refresh"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && events.length === 0 && (
        <div>
          <div className="skeleton skeleton-card" style={{ height: 60 }} />
          <div className="skeleton skeleton-card" style={{ height: 60 }} />
          <div className="skeleton skeleton-card" style={{ height: 60 }} />
          <div className="skeleton skeleton-card" style={{ height: 60 }} />
          <div className="skeleton skeleton-card" style={{ height: 60 }} />
        </div>
      )}

      {/* Empty */}
      {!loading && events.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <p>No recent activity found. Try loading more blocks.</p>
        </div>
      )}

      {/* Timeline */}
      <div className="activity-timeline">
        {events.map((evt, i) => {
          const config = EVENT_CONFIG[evt.name] || { icon: "📌", color: "var(--text-muted)" };
          return (
            <div className="activity-item" key={`${evt.transactionHash}-${evt.name}-${i}`} style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="activity-dot" style={{ background: config.color }}>
                <span>{config.icon}</span>
              </div>
              <div className="activity-body">
                <p className="activity-text">{formatEvent(evt, evt.projectName)}</p>
                <div className="activity-meta">
                  <Link to={`/project/${evt.address}`} className="activity-link">View Project →</Link>
                  <span className="text-xs text-muted">Block #{evt.blockNumber}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
