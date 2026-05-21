import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, fmtDate, stateBadge, msLabel, shortAddr, parseEther } from "../utils/formatters";
import { formatEther } from "ethers";

// ─── Proof helpers ───────────────────────────────────────────────────────────

/** Create an empty proof item */
function emptyProof() {
  return { type: "url", value: "" };
}

/** Serialize proof items array → JSON string for on-chain storage */
function serializeProofs(items) {
  return JSON.stringify(items.filter((p) => p.value.trim()));
}

/** Parse a reportURI back into proof items. Falls back to legacy text. */
function parseProofs(reportURI) {
  if (!reportURI) return [];
  try {
    const parsed = JSON.parse(reportURI);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not JSON — legacy plain text report
  }
  return [{ type: "text", value: reportURI }];
}

/** Convert a YouTube / Vimeo watch URL into an embeddable URL */
function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    }
    // Vimeo
    const vm = u.pathname.match(/^\/(\d+)/);
    if (u.hostname.includes("vimeo.com") && vm) {
      return `https://player.vimeo.com/video/${vm[1]}`;
    }
  } catch { /* not a valid URL */ }
  return url;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Proof Builder — used by the project creator to compose proof items */
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
        <button
          type="button"
          className="proof-submit-btn"
          disabled={!hasContent || disabled}
          onClick={() => onSubmit(serializeProofs(items))}
        >
          Submit Milestone Proof
        </button>
      </div>
    </div>
  );
}

/** Proof Viewer — renders proof items for backers to review */
function ProofViewer({ proofs, onImageClick }) {
  if (!proofs.length) return null;

  return (
    <div className="proof-section">
      <div className="proof-section-title">📋 Submitted Proof ({proofs.length} item{proofs.length !== 1 ? "s" : ""})</div>
      <div className="proof-grid">
        {proofs.map((p, i) => (
          <ProofCard key={i} proof={p} onImageClick={onImageClick} />
        ))}
      </div>
    </div>
  );
}

/** Individual proof card */
function ProofCard({ proof, onImageClick }) {
  const { type, value } = proof;

  if (type === "image") {
    return (
      <div className="proof-card">
        <div className="proof-card-header">🖼️ Image</div>
        <div className="proof-image-wrap" onClick={() => onImageClick(value)}>
          <img src={value} alt="Proof" loading="lazy" onError={(e) => { e.target.style.display = "none"; }} />
        </div>
      </div>
    );
  }

  if (type === "video") {
    const embedUrl = toEmbedUrl(value);
    const isEmbed = embedUrl !== value || value.includes("embed");
    return (
      <div className="proof-card">
        <div className="proof-card-header">🎬 Video</div>
        <div className="proof-video-wrap">
          {isEmbed ? (
            <iframe src={embedUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Proof video" />
          ) : (
            <video controls src={value} />
          )}
        </div>
      </div>
    );
  }

  if (type === "url") {
    return (
      <div className="proof-card">
        <div className="proof-card-header">🔗 URL / Beta Link</div>
        <a href={value} target="_blank" rel="noopener noreferrer" className="proof-url-link">
          {value}
        </a>
      </div>
    );
  }

  // type === "text" or legacy
  return (
    <div className="proof-card">
      <div className="proof-card-header">📝 Note</div>
      <div className="proof-card-body proof-text">{value}</div>
    </div>
  );
}

/** Image lightbox overlay */
function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={src} alt="Expanded proof" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { address } = useParams();
  const { getProjectContract, account, provider } = useWeb3();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contributeAmt, setContributeAmt] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [creatorBalance, setCreatorBalance] = useState(null);

  // Per-milestone proof items the creator is building (keyed by milestone index)
  const [proofDrafts, setProofDrafts] = useState({});

  const contract = getProjectContract(address);

  useEffect(() => {
    // Reset stale data when navigating to a different project
    setProject(null);
    setMilestones([]);
    setCreatorBalance(null);
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
        const voted = account ? await contract.hasVoted(account, i) : false;
        arr.push({
          description: m.descriptions[i],
          amount: m.amounts[i],
          deadline: m.deadlines[i],
          status: Number(m.statuses[i]),
          reportURI: m.reportURIs[i],
          yesVotes: m.yesVotesArr[i],
          noVotes: m.noVotesArr[i],
          votingDeadline: m.votingDeadlines[i],
          hasVoted: voted,
        });
      }
      setMilestones(arr);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  // Fetch the developer's wallet balance from chain
  async function fetchCreatorBalance(creatorAddr) {
    if (!provider || !creatorAddr) return;
    try {
      const bal = await provider.getBalance(creatorAddr);
      setCreatorBalance(bal);
    } catch (e) {
      console.error("Failed to fetch creator balance", e);
    }
  }

  // Refresh creator balance whenever project loads
  useEffect(() => {
    if (project?.creator) fetchCreatorBalance(project.creator);
  }, [project?.creator, provider]);

  async function doTx(label, fn) {
    setTxStatus(`${label}…`);
    try {
      const tx = await fn();
      setTxStatus("Confirming…");
      await tx.wait();
      setTxStatus(`${label} ✓`);
      await loadProject();
      // Refresh developer wallet balance after tx completes
      if (project?.creator) await fetchCreatorBalance(project.creator);
    } catch (e) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
  }

  // Proof draft helpers
  function getProofDraft(idx) {
    return proofDrafts[idx] || [emptyProof()];
  }
  function setProofDraft(idx, items) {
    setProofDrafts((prev) => ({ ...prev, [idx]: items }));
  }

  // ─── Guards ────────────────────────────────────────────────────────────────
  if (!account) return <div className="connect-prompt"><span className="prompt-icon">🔗</span><p>Connect wallet first.</p></div>;
  if (loading) return <div className="loading-state"><div className="loading-spinner" /><p>Loading project…</p></div>;
  if (!project) return <div className="connect-prompt"><span className="prompt-icon">⚠️</span><p className="error">Failed to load project.</p></div>;

  const { label, cls } = stateBadge(project.state);
  const isCreator = account.toLowerCase() === project.creator.toLowerCase();
  const pct = project.goal > 0n ? Number((project.funded * 100n) / project.goal) : 0;
  const isFunding = Number(project.state) === 0;
  const isActive = Number(project.state) === 1;
  const isCancelled = Number(project.state) === 3;

  return (
    <div>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* Header */}
      <div className="page-header">
        <div className="flex-between">
          <h1><span className="gradient-text">{project.name}</span></h1>
          <span className={`badge ${cls}`}>{label}</span>
        </div>
        <p className="subtitle">{project.description}</p>
      </div>

      {/* Summary Card */}
      <div className="card">
        <div className="flex-between" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-label">Creator</span>
                <span className="stat-value">
                  <Link to={`/profile/${project.creator}`} style={{ color: 'var(--text-accent)', textDecoration: 'none' }}>
                    {shortAddr(project.creator)}
                  </Link>
                  {isCreator && <span className="text-muted"> (you)</span>}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Contract</span>
                <span className="stat-value">{shortAddr(address)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Funded</span>
                <span className="stat-value">{fmtEth(project.funded)} / {fmtEth(project.goal)} ETH</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Released</span>
                <span className="stat-value">{fmtEth(project.released)} ETH</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Contract Balance</span>
                <span className="stat-value">{fmtEth(project.balance)} ETH</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Deadline</span>
                <span className="stat-value">{fmtDate(project.deadline)}</span>
              </div>
              {creatorBalance !== null && (
                <div className="stat-item">
                  <span className="stat-label">Developer Wallet</span>
                  <span className="stat-value">{parseFloat(formatEther(creatorBalance)).toFixed(4)} ETH</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Ring */}
          <div className="progress-ring-wrapper" style={{ marginLeft: '1.5rem' }}>
            <svg className="progress-ring" viewBox="0 0 56 56">
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <circle className="ring-bg" cx="28" cy="28" r="24" />
              <circle
                className="ring-fill"
                cx="28" cy="28" r="24"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - Math.min(pct, 100) / 100)}`}
              />
            </svg>
            <div>
              <div className="progress-ring-text gradient-text">{pct}%</div>
              <div className="text-xs text-muted">funded</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-track" style={{ marginTop: '1rem' }}>
          <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {/* Contribute (Funding state only) */}
      {isFunding && (
        <div className="card">
          <h3>💰 Contribute</h3>
          <div className="contribute-section">
            <input
              type="number"
              step="0.001"
              placeholder="ETH amount"
              value={contributeAmt}
              onChange={(e) => setContributeAmt(e.target.value)}
            />
            <button
              onClick={() =>
                doTx("Contributing", () =>
                  contract.contribute({ value: parseEther(contributeAmt) })
                )
              }
              disabled={!contributeAmt}
            >
              Fund Project
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="action-bar">
        {isCreator && (isFunding || isActive) && (
          <Link to={`/project/${address}/manage`}>
            <button className="btn-primary">⚙ Manage Project</button>
          </Link>
        )}
        {(isCancelled || isFunding) && !isCreator && (
          <button className="btn-secondary" onClick={() => doTx("Claiming refund", () => contract.claimRefund())}>
            Claim Refund
          </button>
        )}
        <button className="btn-secondary" onClick={loadProject}>🔄 Refresh</button>
      </div>

      {/* Milestones */}
      <h2><span className="gradient-text">Milestones</span></h2>
      {milestones.map((m, i) => {
        const msStatus = msLabel(m.status);
        const isSubmitted = m.status === 1;
        const isPending = m.status === 0;
        const isApproved = m.status === 2;
        const isRejected = m.status === 3;
        const votingEnded = m.votingDeadline > 0 && Date.now() / 1000 > Number(m.votingDeadline);
        const proofs = parseProofs(m.reportURI);

        const statusClass = isPending ? "status-pending" :
          isSubmitted ? "status-submitted" :
            isApproved ? "status-approved" :
              isRejected ? "status-rejected" : "status-pending";

        const badgeCls = isPending ? "badge-pending" :
          isSubmitted ? "badge-submitted" :
            isApproved ? "badge-approved" :
              isRejected ? "badge-rejected" : "badge-active";

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

            {/* Proof Viewer */}
            {proofs.length > 0 && (
              <ProofViewer proofs={proofs} onImageClick={setLightboxSrc} />
            )}

            {/* Voting info */}
            {isSubmitted && (
              <div className="text-sm" style={{ margin: "0.5rem 0" }}>
                Votes: ✅ {fmtEth(m.yesVotes)} / ❌ {fmtEth(m.noVotes)} ETH
                {m.votingDeadline > 0 && (
                  <span className="text-muted"> · Voting ends: {fmtDate(m.votingDeadline)}</span>
                )}
              </div>
            )}

            {/* Auto-finalize notice */}
            {isApproved && (
              <div className="auto-finalize-notice">
                ✅ Funds automatically released — {fmtEth(m.amount)} ETH sent to developer
              </div>
            )}

            {/* Creator: link to manage page */}
            {isPending && isCreator && (
              <div style={{ marginTop: "0.75rem" }}>
                <Link to={`/project/${address}/manage`}>
                  <button className="btn-secondary" style={{ fontSize: "0.85rem" }}>📝 Submit proof on Manage page →</button>
                </Link>
              </div>
            )}

            {/* Backer: Vote buttons */}
            {isActive && isSubmitted && !isCreator && !m.hasVoted && !votingEnded && (
              <div className="vote-actions">
                <button
                  className="vote-btn approve"
                  onClick={() =>
                    doTx("Voting YES — approving milestone", () =>
                      contract.voteOnMilestone(i, true)
                    )
                  }
                >
                  👍 Approve Milestone
                </button>
                <button
                  className="vote-btn reject"
                  onClick={() =>
                    doTx("Voting NO — rejecting milestone", () =>
                      contract.voteOnMilestone(i, false)
                    )
                  }
                >
                  👎 Reject Milestone
                </button>
              </div>
            )}

            {/* Already voted notice */}
            {isSubmitted && m.hasVoted && (
              <p className="text-sm text-muted" style={{ marginTop: "0.5rem" }}>✓ You already voted on this milestone.</p>
            )}

            {/* Finalize button */}
            {isActive && isSubmitted && votingEnded && (
              <button
                style={{ marginTop: "0.75rem" }}
                onClick={() =>
                  doTx("Finalizing milestone", () => contract.finalizeMilestone(i))
                }
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
