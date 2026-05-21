import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, fmtDate, stateBadge, msLabel, shortAddr } from "../utils/formatters";
import { formatEther } from "ethers";

// ─── Proof helpers (same as ProjectDetail) ─────────────────────────────────
function emptyProof() {
  return { type: "url", value: "" };
}
function serializeProofs(items) {
  return JSON.stringify(items.filter((p) => p.value.trim()));
}

function ProofBuilder({ items, onChange, onSubmit, disabled }) {
  function add() { onChange([...items, emptyProof()]); }
  function remove(idx) { onChange(items.filter((_, i) => i !== idx)); }
  function update(idx, field, val) {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: val };
    onChange(copy);
  }
  const hasContent = items.some((p) => p.value.trim());

  return (
    <div className="proof-builder">
      <h4>📎 Attach Proof of Work</h4>
      {items.map((p, i) => (
        <div className="proof-item-row" key={i}>
          <select value={p.type} onChange={(e) => update(i, "type", e.target.value)}>
            <option value="url">URL</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="text">Text</option>
          </select>
          <input
            placeholder={
              p.type === "url" ? "https://beta.myapp.com" :
              p.type === "image" ? "https://i.imgur.com/example.png" :
              p.type === "video" ? "https://youtu.be/xxxxx" :
              "Describe your progress…"
            }
            value={p.value}
            onChange={(e) => update(i, "value", e.target.value)}
          />
          <button className="btn-remove" type="button" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <div className="flex-wrap" style={{ marginTop: "0.5rem" }}>
        <button type="button" className="proof-add-btn" onClick={add}>+ Add Item</button>
        <button type="button" className="proof-submit-btn" disabled={!hasContent || disabled} onClick={() => onSubmit(serializeProofs(items))}>
          Submit Milestone Proof
        </button>
      </div>
    </div>
  );
}

export default function ProjectManage() {
  const { address } = useParams();
  const { getProjectContract, account, provider } = useWeb3();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState("");
  const [creatorBalance, setCreatorBalance] = useState(null);
  const [proofDrafts, setProofDrafts] = useState({});

  const contract = getProjectContract(address);

  useEffect(() => {
    setProject(null);
    setMilestones([]);
    setTxStatus("");
    setProofDrafts({});
    if (contract) loadProject();
  }, [address, account]);

  async function loadProject() {
    setLoading(true);
    try {
      const s = await contract.getProjectSummary();
      setProject({
        creator: s._creator,
        name: s._name,
        description: s._description,
        goal: s._fundingGoal,
        deadline: s._fundingDeadline,
        funded: s._totalFunded,
        state: s._state,
        milestoneCount: Number(s._milestoneCount),
        released: s._totalReleased,
        balance: await contract.getContractBalance(),
      });

      const m = await contract.getMilestones();
      const arr = [];
      for (let i = 0; i < m.descriptions.length; i++) {
        arr.push({
          description: m.descriptions[i],
          amount: m.amounts[i],
          deadline: m.deadlines[i],
          status: Number(m.statuses[i]),
          reportURI: m.reportURIs[i],
          yesVotes: m.yesVotesArr[i],
          noVotes: m.noVotesArr[i],
          votingDeadline: m.votingDeadlines[i],
        });
      }
      setMilestones(arr);

      // Fetch creator balance
      if (provider && s._creator) {
        try {
          const bal = await provider.getBalance(s._creator);
          setCreatorBalance(bal);
        } catch {}
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function doTx(label, fn) {
    setTxStatus(`${label}…`);
    try {
      const tx = await fn();
      setTxStatus("Confirming…");
      await tx.wait();
      setTxStatus(`${label} ✓`);
      await loadProject();
    } catch (e) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
  }

  function getProofDraft(idx) {
    return proofDrafts[idx] || [emptyProof()];
  }
  function setProofDraft(idx, items) {
    setProofDrafts((prev) => ({ ...prev, [idx]: items }));
  }

  // Guards
  if (!account) return <div className="connect-prompt"><span className="prompt-icon">🔗</span><p>Connect wallet first.</p></div>;
  if (loading) return <div className="loading-state"><div className="loading-spinner" /><p>Loading project…</p></div>;
  if (!project) return <div className="connect-prompt"><span className="prompt-icon">⚠️</span><p className="error">Failed to load project.</p></div>;

  const isCreator = account.toLowerCase() === project.creator.toLowerCase();
  if (!isCreator) {
    return (
      <div className="connect-prompt">
        <span className="prompt-icon">🔒</span>
        <p>Only the project creator can access this page.</p>
        <Link to={`/project/${address}`}>
          <button className="btn-shimmer" style={{ marginTop: "1rem" }}>← View Project</button>
        </Link>
      </div>
    );
  }

  const { label, cls } = stateBadge(project.state);
  const pct = project.goal > 0n ? Number((project.funded * 100n) / project.goal) : 0;
  const isFunding = Number(project.state) === 0;
  const isActive = Number(project.state) === 1;
  const pendingMilestones = milestones.filter(m => m.status === 0).length;
  const submittedMilestones = milestones.filter(m => m.status === 1).length;
  const approvedMilestones = milestones.filter(m => m.status === 2).length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex-between">
          <div>
            <p className="text-sm text-muted" style={{ marginBottom: "0.25rem" }}>⚙ Project Management</p>
            <h1><span className="gradient-text">{project.name}</span></h1>
          </div>
          <div className="flex" style={{ gap: "0.5rem" }}>
            <span className={`badge ${cls}`}>{label}</span>
            <Link to={`/project/${address}`}><button className="btn-secondary">👁 Public View</button></Link>
          </div>
        </div>
      </div>

      {/* Overview Card */}
      <div className="card">
        <div className="stat-grid">
          <div className="stat-item">
            <span className="stat-label">Funded</span>
            <span className="stat-value">{fmtEth(project.funded)} / {fmtEth(project.goal)} ETH ({pct}%)</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Released</span>
            <span className="stat-value">{fmtEth(project.released)} ETH</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Contract Balance</span>
            <span className="stat-value">{fmtEth(project.balance)} ETH</span>
          </div>
          {creatorBalance !== null && (
            <div className="stat-item">
              <span className="stat-label">Your Wallet</span>
              <span className="stat-value">{parseFloat(formatEther(creatorBalance)).toFixed(4)} ETH</span>
            </div>
          )}
          <div className="stat-item">
            <span className="stat-label">Deadline</span>
            <span className="stat-value">{fmtDate(project.deadline)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Milestones</span>
            <span className="stat-value">
              {approvedMilestones}/{milestones.length} approved
              {submittedMilestones > 0 && <span className="text-muted"> · {submittedMilestones} voting</span>}
              {pendingMilestones > 0 && <span className="text-muted"> · {pendingMilestones} pending</span>}
            </span>
          </div>
        </div>
        <div className="progress-bar-track" style={{ marginTop: "1rem" }}>
          <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="action-bar">
        {(isFunding || isActive) && (
          <button className="btn-danger" onClick={() => doTx("Cancelling", () => contract.cancelProject())}>
            🛑 Cancel Project
          </button>
        )}
        <button className="btn-secondary" onClick={loadProject}>🔄 Refresh</button>
      </div>

      {/* Milestones */}
      <h2><span className="gradient-text">Milestone Management</span></h2>
      {milestones.map((m, i) => {
        const msStatus = msLabel(m.status);
        const isPending = m.status === 0;
        const isSubmitted = m.status === 1;
        const isApproved = m.status === 2;
        const isRejected = m.status === 3;
        const votingEnded = m.votingDeadline > 0 && Date.now() / 1000 > Number(m.votingDeadline);

        const statusClass = isPending ? "status-pending" : isSubmitted ? "status-submitted" : isApproved ? "status-approved" : isRejected ? "status-rejected" : "status-pending";
        const badgeCls = isPending ? "badge-pending" : isSubmitted ? "badge-submitted" : isApproved ? "badge-approved" : isRejected ? "badge-rejected" : "badge-active";

        return (
          <div className={`milestone-card ${statusClass}`} key={i} style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="milestone-header">
              <h3 className="milestone-title">#{i + 1}: {m.description}</h3>
              <span className={`badge ${badgeCls}`}>{msStatus}</span>
            </div>
            <div className="milestone-meta">
              <span>💎 {fmtEth(m.amount)} ETH</span>
              <span>📅 {fmtDate(m.deadline)}</span>
            </div>

            {/* Voting info for submitted milestones */}
            {isSubmitted && (
              <div className="manage-vote-summary">
                <div className="manage-vote-bar">
                  <div className="manage-vote-yes" style={{ width: `${m.yesVotes + m.noVotes > 0n ? Number((m.yesVotes * 100n) / (m.yesVotes + m.noVotes)) : 0}%` }} />
                </div>
                <div className="flex-between text-sm">
                  <span style={{ color: "var(--color-approved)" }}>✅ {fmtEth(m.yesVotes)} ETH</span>
                  <span style={{ color: "var(--color-rejected)" }}>❌ {fmtEth(m.noVotes)} ETH</span>
                </div>
                {m.votingDeadline > 0 && (
                  <p className="text-xs text-muted" style={{ marginTop: "0.25rem" }}>
                    {votingEnded ? "⏰ Voting ended" : `⏰ Voting ends: ${fmtDate(m.votingDeadline)}`}
                  </p>
                )}
              </div>
            )}

            {/* Approved notice */}
            {isApproved && (
              <div className="auto-finalize-notice">
                ✅ Funds released — {fmtEth(m.amount)} ETH sent to your wallet
              </div>
            )}

            {/* Rejected notice */}
            {isRejected && (
              <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", color: "var(--color-rejected)" }}>
                ❌ This milestone was rejected by backers
              </div>
            )}

            {/* Proof Builder for pending milestones */}
            {isPending && isActive && (
              <ProofBuilder
                items={getProofDraft(i)}
                onChange={(items) => setProofDraft(i, items)}
                disabled={txStatus.includes("…")}
                onSubmit={(json) =>
                  doTx("Submitting milestone proof", () =>
                    contract.submitMilestoneReport(i, json)
                  )
                }
              />
            )}

            {/* Finalize button */}
            {isActive && isSubmitted && votingEnded && (
              <button
                style={{ marginTop: "0.75rem" }}
                onClick={() => doTx("Finalizing milestone", () => contract.finalizeMilestone(i))}
              >
                ⚡ Finalize Milestone
              </button>
            )}
          </div>
        );
      })}

      {/* TX Status */}
      {txStatus && (
        <div className={`tx-status ${txStatus.startsWith("Error") ? "tx-error" : "tx-success"}`}>
          {txStatus}
        </div>
      )}
    </div>
  );
}
