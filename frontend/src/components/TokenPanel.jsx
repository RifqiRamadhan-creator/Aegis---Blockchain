import { useEffect, useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import { fmtEth, parseEther, shortAddr } from "../utils/formatters";

export default function TokenPanel({ title = "Aegis Token", contract: externalToken, tokenAddress: externalAddress }) {
  const { account, token: defaultToken } = useWeb3();
  const token = externalToken || defaultToken;
  const address = externalAddress || token?.address || "";

  const [balance, setBalance] = useState(null);
  const [delegatee, setDelegatee] = useState("");
  const [totalSupply, setTotalSupply] = useState(null);
  const [owner, setOwner] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const canMint = account && owner && account.toLowerCase() === owner.toLowerCase();

  async function refresh() {
    if (!token || !account) return;
    setLoading(true);
    setStatus("");

    try {
      const [balanceResult, delegated, supply, ownerResult] = await Promise.all([
        token.balanceOf(account),
        token.delegates(account),
        token.totalSupply(),
        token.owner(),
      ]);

      setBalance(balanceResult);
      setDelegatee(delegated);
      setTotalSupply(supply);
      setOwner(ownerResult);
    } catch (e) {
      setStatus(`Error loading token data: ${e.reason || e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !account) return;
    refresh();
  }, [token, account]);

  async function delegateSelf() {
    if (!token || !account) return;
    setActionLoading(true);
    setStatus("Delegating votes to self…");
    try {
      const tx = await token.delegate(account);
      await tx.wait();
      setStatus("Delegated successfully.");
      await refresh();
    } catch (e) {
      setStatus(`Error delegating votes: ${e.reason || e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function mintTokens() {
    if (!token || !account) return;
    if (!mintAmount) {
      setStatus("Enter an amount to mint.");
      return;
    }

    setActionLoading(true);
    setStatus("Minting tokens…");

    try {
      const weiAmount = parseEther(mintAmount);
      const tx = await token.mint(account, weiAmount);
      await tx.wait();
      setStatus("Mint successful.");
      setMintAmount("");
      await refresh();
    } catch (e) {
      setStatus(`Error minting tokens: ${e.reason || e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  if (!account) return null;

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3>{title}</h3>

      {!token ? (
        <p className="text-muted">
          Aegis token is not configured. Set <code>VITE_TOKEN_ADDRESS</code> in <code>.env</code>.
        </p>
      ) : (
        <>
          <div className="text-sm text-muted" style={{ marginBottom: "0.75rem" }}>
            Token contract: {address ? shortAddr(address) : "Unknown"}
          </div>

          <div className="flex-between" style={{ gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div className="text-sm text-muted">Balance</div>
              <div>{balance !== null ? `${fmtEth(balance)} AEGIS` : "Loading…"}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Delegated to</div>
              <div>{delegatee && delegatee !== "0x0000000000000000000000000000000000000000" ? shortAddr(delegatee) : "Not delegated"}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Total supply</div>
              <div>{totalSupply !== null ? `${fmtEth(totalSupply)} AEGIS` : "Loading…"}</div>
            </div>
          </div>

          <div className="flex-wrap" style={{ gap: "0.5rem", marginTop: "1rem" }}>
            <button className="btn-secondary" type="button" disabled={actionLoading} onClick={delegateSelf}>
              Delegate to self
            </button>
            <button className="btn-secondary" type="button" disabled={actionLoading} onClick={refresh}>
              Refresh
            </button>
          </div>

          {canMint && (
            <div style={{ marginTop: "1rem" }}>
              <label className="text-sm text-muted">Mint AEGIS to your wallet</label>
              <div className="flex" style={{ gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Amount"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  style={{ flex: "1 1 160px" }}
                />
                <button className="btn-secondary" type="button" disabled={actionLoading} onClick={mintTokens}>
                  Mint
                </button>
              </div>
            </div>
          )}

          {!canMint && owner && (
            <p className="text-sm text-muted" style={{ marginTop: "0.75rem" }}>
              Only token owner {shortAddr(owner)} can mint AEGIS.
            </p>
          )}

          {status && (
            <p className={status.startsWith("Error") ? "error mt-1" : "success mt-1"} style={{ marginTop: "0.75rem" }}>
              {status}
            </p>
          )}
        </>
      )}
    </div>
  );
}
