import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { parseEther } from "../utils/formatters";

export default function CreateProject() {
  const { factory, account } = useWeb3();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalEth, setGoalEth] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [milestones, setMilestones] = useState([
    { description: "", amountEth: "", deadlineDays: "30" },
  ]);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function addMilestone() {
    setMilestones([...milestones, { description: "", amountEth: "", deadlineDays: "30" }]);
  }

  function removeMilestone(i) {
    setMilestones(milestones.filter((_, idx) => idx !== i));
  }

  function updateMilestone(i, field, value) {
    const updated = [...milestones];
    updated[i] = { ...updated[i], [field]: value };
    setMilestones(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!factory) { setStatus("Factory not connected"); return; }
    setSubmitting(true);
    setStatus("Submitting transaction…");

    try {
      const goal = parseEther(goalEth);
      const now = Math.floor(Date.now() / 1000);
      const fundingDeadline = now + parseInt(deadlineDays) * 86400;

      const mDescs = milestones.map((m) => m.description);
      const mAmounts = milestones.map((m) => parseEther(m.amountEth));
      const mDeadlines = milestones.map(
        (m, i) => fundingDeadline + (i + 1) * parseInt(m.deadlineDays) * 86400
      );

      const tx = await factory.createProject({
        name,
        description,
        fundingGoal: goal,
        fundingDeadline,
        mDescriptions: mDescs,
        mAmounts,
        mDeadlines,
      });
      setStatus("Waiting for confirmation…");
      const receipt = await tx.wait();

      let projectAddress = null;
      for (const log of receipt.logs) {
        if (log.fragment && log.fragment.name === "ProjectCreated") {
          projectAddress = log.args?.projectAddress || log.args?.[0];
          break;
        }
      }
      if (!projectAddress) {
        for (const log of receipt.logs) {
          try {
            const parsed = factory.interface.parseLog({
              topics: log.topics,
              data: log.data,
            });
            if (parsed && parsed.name === "ProjectCreated") {
              projectAddress = parsed.args?.projectAddress || parsed.args?.[0];
              break;
            }
          } catch { }
        }
      }
      if (!projectAddress) {
        try {
          const allProjects = await factory.getProjects();
          if (allProjects.length > 0) {
            projectAddress = allProjects[allProjects.length - 1];
          }
        } catch { }
      }

      if (projectAddress) {
        setStatus("Project created!");
        navigate(`/project/${projectAddress}`);
      } else {
        setStatus("Project created! Redirecting…");
        navigate("/");
      }
    } catch (e) {
      setStatus(`Error: ${e.reason || e.message}`);
    }
    setSubmitting(false);
  }

  if (!account) {
    return (
      <div className="connect-prompt">
        <span className="prompt-icon">🔗</span>
        <p>Connect your wallet first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1><span className="gradient-text">Create Project</span></h1>
        <p className="subtitle">Launch your milestone-based crowdfunding campaign on Ethereum.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-card">
          <div className="form-group">
            <label>Project Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="My Awesome Project" />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} placeholder="What are you building?" />
          </div>

          <div className="form-group">
            <label>Funding Goal (ETH)</label>
            <input type="number" step="0.001" value={goalEth} onChange={(e) => setGoalEth(e.target.value)} required placeholder="10" />
          </div>

          <div className="form-group">
            <label>Funding Period (days from now)</label>
            <input type="number" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} required />
          </div>
        </div>

        <h2><span className="gradient-text">Milestones</span></h2>
        <p className="text-sm text-muted mb-1">
          Define deliverables for your project. Milestone amounts must sum to the funding goal.
        </p>

        {milestones.map((m, i) => (
          <div className="milestone-builder-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="milestone-number">Milestone {i + 1}</span>
            <div style={{ marginTop: '0.5rem' }}>
              <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Milestone {i + 1}</h3>
                {milestones.length > 1 && (
                  <button type="button" className="btn-danger" onClick={() => removeMilestone(i)} style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}>Remove</button>
                )}
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={m.description} onChange={(e) => updateMilestone(i, "description", e.target.value)} required placeholder="What will be delivered" />
              </div>
              <div className="form-group">
                <label>Amount (ETH)</label>
                <input type="number" step="0.001" value={m.amountEth} onChange={(e) => updateMilestone(i, "amountEth", e.target.value)} required placeholder="5" />
              </div>
              <div className="form-group">
                <label>Deadline (days after funding ends)</label>
                <input type="number" value={m.deadlineDays} onChange={(e) => updateMilestone(i, "deadlineDays", e.target.value)} required />
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="btn-add-milestone" onClick={addMilestone}>
          + Add Milestone
        </button>

        <button type="submit" disabled={submitting} className="btn-submit-full">
          {submitting ? "Creating…" : "🚀 Create Project"}
        </button>

        {status && (
          <div className={`tx-status ${status.startsWith("Error") ? "tx-error" : "tx-success"}`}>
            {status}
          </div>
        )}
      </form>
    </div>
  );
}
