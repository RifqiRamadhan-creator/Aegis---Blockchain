import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, fmtDate, stateBadge, msLabel, shortAddr, parseEther } from "../utils/formatters";

export default function ProjectDetail() {
  const { address } = useParams();
  const { getProjectContract, account } = useWeb3();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contributeAmt, setContributeAmt] = useState("");
  const [reportTexts, setReportTexts] = useState({});
  const [txStatus, setTxStatus] = useState("");

  const contract = getProjectContract(address);

  useEffect(() => {
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

  async function doTx(label, fn) {
    setTxStatus(`${label}…`);
    try {
      const tx = await fn();
      setTxStatus("Confirming…");
      await tx.wait();
      setTxStatus(`${label} ✓`);
      loadProject();
    } catch (e) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
  }

  if (!account) return <p className="text-muted text-center mt-1">Connect wallet first.</p>;
  if (loading) return <p className="text-muted text-center mt-1">Loading…</p>;
  if (!project) return <p className="error text-center mt-1">Failed to load project.</p>;

  const { label, cls } = stateBadge(project.state);
  const isCreator = account.toLowerCase() === project.creator.toLowerCase();
  const pct = project.goal > 0n ? Number((project.funded * 100n) / project.goal) : 0;
  const isFunding = Number(project.state) === 0;
  const isActive = Number(project.state) === 1;
  const isCancelled = Number(project.state) === 3;

  return (
    <div>
      {/* Header */}
      <div className="flex-between">
        <h1>{project.name}</h1>
        <span className={`badge ${cls}`}>{label}</span>
      </div>
      <p className="text-muted mb-1">{project.description}</p>

      {/* Summary */}
      <div className="card">
        <div className="flex-between text-sm">
          <span>Creator: {shortAddr(project.creator)} {isCreator && "(you)"}</span>
          <span>Contract: {shortAddr(address)}</span>
        </div>
        <div className="flex-between text-sm mt-1">
          <span>Funded: {fmtEth(project.funded)} / {fmtEth(project.goal)} ETH ({pct}%)</span>
          <span>Released: {fmtEth(project.released)} ETH</span>
        </div>
        <div className="flex-between text-sm" style={{ marginTop: "0.25rem" }}>
          <span>Balance: {fmtEth(project.balance)} ETH</span>
          <span>Deadline: {fmtDate(project.deadline)}</span>
        </div>
      </div>

      {/* Contribute (Funding state only) */}
      {isFunding && (
        <div className="card">
          <h3>Contribute</h3>
          <div className="flex" style={{ marginTop: "0.5rem" }}>
            <input
              type="number"
              step="0.001"
              placeholder="ETH amount"
              value={contributeAmt}
              onChange={(e) => setContributeAmt(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <button
              onClick={() => doTx("Contributing", () => contract.contribute({ value: parseEther(contributeAmt) }))}
              disabled={!contributeAmt}
            >
              Fund
            </button>
          </div>
        </div>
      )}

      {/* Cancel / Refund */}
      <div className="flex" style={{ marginBottom: "1rem" }}>
        {(isFunding || isActive) && isCreator && (
          <button className="btn-danger" onClick={() => doTx("Cancelling", () => contract.cancelProject())}>
            Cancel Project
          </button>
        )}
        {(isCancelled || isFunding) && !isCreator && (
          <button className="btn-secondary" onClick={() => doTx("Claiming refund", () => contract.claimRefund())}>
            Claim Refund
          </button>
        )}
        <button className="btn-secondary" onClick={loadProject}>Refresh</button>
      </div>

      {/* Milestones */}
      <h2>Milestones</h2>
      {milestones.map((m, i) => {
        const msStatus = msLabel(m.status);
        const isSubmitted = m.status === 1;
        const isPending = m.status === 0;
        const votingEnded = m.votingDeadline > 0 && Date.now() / 1000 > Number(m.votingDeadline);

        return (
          <div className="card" key={i}>
            <div className="flex-between">
              <h3>#{i + 1}: {m.description}</h3>
              <span className="badge badge-active">{msStatus}</span>
            </div>
            <div className="text-sm text-muted" style={{ margin: "0.25rem 0" }}>
              Amount: {fmtEth(m.amount)} ETH · Deadline: {fmtDate(m.deadline)}
            </div>

            {/* Report */}
            {m.reportURI && (
              <div className="text-sm" style={{ margin: "0.25rem 0", padding: "0.5rem", background: "#0f1117", borderRadius: "4px" }}>
                <strong>Report:</strong> {m.reportURI}
              </div>
            )}

            {/* Voting info */}
            {isSubmitted && (
              <div className="text-sm" style={{ margin: "0.25rem 0" }}>
                Votes: ✅ {fmtEth(m.yesVotes)} / ❌ {fmtEth(m.noVotes)} ETH
                {m.votingDeadline > 0 && (
                  <span className="text-muted"> · Voting ends: {fmtDate(m.votingDeadline)}</span>
                )}
              </div>
            )}

            {/* Creator: submit report */}
            {isActive && isPending && isCreator && (
              <div className="flex" style={{ marginTop: "0.5rem" }}>
                <input
                  placeholder="Progress report or URI"
                  value={reportTexts[i] || ""}
                  onChange={(e) => setReportTexts({ ...reportTexts, [i]: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
                <button
                  onClick={() => doTx("Submitting report", () => contract.submitMilestoneReport(i, reportTexts[i]))}
                  disabled={!reportTexts[i]}
                >
                  Submit
                </button>
              </div>
            )}

            {/* Backer: vote */}
            {isActive && isSubmitted && !isCreator && !m.hasVoted && !votingEnded && (
              <div className="flex" style={{ marginTop: "0.5rem" }}>
                <button className="btn-success" onClick={() => doTx("Voting yes", () => contract.voteOnMilestone(i, true))}>
                  ✅ Approve
                </button>
                <button className="btn-danger" onClick={() => doTx("Voting no", () => contract.voteOnMilestone(i, false))}>
                  ❌ Reject
                </button>
              </div>
            )}
            {isSubmitted && m.hasVoted && (
              <p className="text-sm text-muted" style={{ marginTop: "0.25rem" }}>You already voted.</p>
            )}

            {/* Finalize */}
            {isActive && isSubmitted && votingEnded && (
              <button
                style={{ marginTop: "0.5rem" }}
                onClick={() => doTx("Finalizing milestone", () => contract.finalizeMilestone(i))}
              >
                Finalize Milestone
              </button>
            )}
          </div>
        );
      })}

      {/* TX Status */}
      {txStatus && (
        <p className={txStatus.startsWith("Error") ? "error mt-1" : "success mt-1"}>{txStatus}</p>
      )}
    </div>
  );
}
