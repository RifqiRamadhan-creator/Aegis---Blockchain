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

      // Parse the ProjectCreated event to get the new project address
      let projectAddress = null;

      // Strategy 1: ethers v6 EventLog objects already have fragment.name
      for (const log of receipt.logs) {
        if (log.fragment && log.fragment.name === "ProjectCreated") {
          projectAddress = log.args?.projectAddress || log.args?.[0];
          break;
        }
      }

      // Strategy 2: manual parseLog for raw log objects
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
          } catch {
            // Log belongs to a different contract — skip
          }
        }
      }

      // Strategy 3: fallback — query the factory for the latest project
      if (!projectAddress) {
        try {
          const allProjects = await factory.getProjects();
          if (allProjects.length > 0) {
            projectAddress = allProjects[allProjects.length - 1];
          }
        } catch {
          // Factory query failed — will redirect to home
        }
      }

      if (projectAddress) {
        setStatus("Project created!");
        navigate(`/project/${projectAddress}`);
      } else {
        // Project was created on-chain, redirect to home to find it
        setStatus("Project created! Redirecting…");
        navigate("/");
      }
    } catch (e) {
      setStatus(`Error: ${e.reason || e.message}`);
    }
    setSubmitting(false);
  }

  if (!account) {
    return <p className="text-muted text-center mt-1">Connect your wallet first.</p>;
  }

  return (
    <div>
      <h1>Create Project</h1>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <label>Project Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="My Awesome Project" />

          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} placeholder="What are you building?" />

          <label>Funding Goal (ETH)</label>
          <input type="number" step="0.001" value={goalEth} onChange={(e) => setGoalEth(e.target.value)} required placeholder="10" />

          <label>Funding Period (days from now)</label>
          <input type="number" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} required />
        </div>

        <h2>Milestones</h2>
        <p className="text-sm text-muted mb-1">
          Milestone amounts must sum to the funding goal.
        </p>

        {milestones.map((m, i) => (
          <div className="card" key={i}>
            <div className="flex-between">
              <h3>Milestone {i + 1}</h3>
              {milestones.length > 1 && (
                <button type="button" className="btn-danger" onClick={() => removeMilestone(i)} style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}>Remove</button>
              )}
            </div>
            <label>Description</label>
            <input value={m.description} onChange={(e) => updateMilestone(i, "description", e.target.value)} required placeholder="What will be delivered" />
            <label>Amount (ETH)</label>
            <input type="number" step="0.001" value={m.amountEth} onChange={(e) => updateMilestone(i, "amountEth", e.target.value)} required placeholder="5" />
            <label>Deadline (days after funding ends)</label>
            <input type="number" value={m.deadlineDays} onChange={(e) => updateMilestone(i, "deadlineDays", e.target.value)} required />
          </div>
        ))}

        <button type="button" className="btn-secondary mb-1" onClick={addMilestone}>+ Add Milestone</button>

        <div>
          <button type="submit" disabled={submitting} style={{ width: "100%", padding: "0.75rem" }}>
            {submitting ? "Creating…" : "Create Project"}
          </button>
        </div>
        {status && <p className={status.startsWith("Error") ? "error mt-1" : "success mt-1"}>{status}</p>}
      </form>
    </div>
  );
}
