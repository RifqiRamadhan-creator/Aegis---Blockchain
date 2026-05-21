import { Outlet, NavLink, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { shortAddr } from "../utils/formatters";

export default function LandingLayout() {
  const { account, connect, disconnect, FACTORY_ADDRESS } = useWeb3();
  return (
    <>
      <nav>
        <div className="flex" style={{ gap: "1.5rem" }}>
          <NavLink to="/landing" className="logo" style={{ textDecoration: "none" }}>
            ⛨ Aegis
          </NavLink>
          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? "nav-active" : ""}>Projects</NavLink>
            <NavLink to="/explore" className={({ isActive }) => isActive ? "nav-active" : ""}>Explore</NavLink>
            <NavLink to="/activity" className={({ isActive }) => isActive ? "nav-active" : ""}>Activity</NavLink>
            <NavLink to="/about" className={({ isActive }) => isActive ? "nav-active" : ""}>About</NavLink>
            {account && (
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "nav-active" : ""}>Dashboard</NavLink>
            )}
            {account && (
              <NavLink to="/create" className={({ isActive }) => isActive ? "nav-active" : ""}>Create</NavLink>
            )}
          </div>
        </div>
        <div className="wallet-actions">
          {!FACTORY_ADDRESS && (
            <span className="factory-warning">⚠ No factory address</span>
          )}
          {account ? (
            <>
              <Link to={`/profile/${account}`} className="account" style={{ textDecoration: 'none' }}>{shortAddr(account)}</Link>
              <button className="btn-secondary" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <button className="btn-shimmer" onClick={connect}>Connect Wallet</button>
          )}
        </div>
      </nav>
      <Outlet />
      <footer className="app-footer">
        <div className="footer-inner">
          <span className="footer-brand">⛨ Aegis</span>
          <span className="footer-sep">·</span>
          <span>Milestone-Based Crowdfunding on Ethereum</span>
          <span className="footer-sep">·</span>
          <Link to="/about">About</Link>
          <span className="footer-sep">·</span>
          <Link to="/guide">Guide</Link>
          <span className="footer-sep">·</span>
          <Link to="/activity">Activity</Link>
          <span className="footer-sep">·</span>
          <Link to="/create">Create Project</Link>
        </div>
      </footer>
    </>
  );
}
