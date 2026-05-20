import { BrowserRouter, Routes, Route, Link, NavLink, Navigate } from "react-router-dom";
import { Web3Provider, useWeb3 } from "./context/Web3Context";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import CreateProject from "./pages/CreateProject";
import ProjectDetail from "./pages/ProjectDetail";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import { shortAddr } from "./utils/formatters";

function Navbar() {
  const { account, connect, disconnect, FACTORY_ADDRESS } = useWeb3();
  return (
    <nav>
      <div className="flex" style={{ gap: "1.5rem" }}>
        <NavLink to="/landing" className="logo" style={{ textDecoration: "none" }}>
          ⛨ Aegis
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? "nav-active" : ""}>
            Projects
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? "nav-active" : ""}>
            About
          </NavLink>
          {account && (
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? "nav-active" : ""}>
              Dashboard
            </NavLink>
          )}
          {account && (
            <NavLink to="/create" className={({ isActive }) => isActive ? "nav-active" : ""}>
              Create
            </NavLink>
          )}
        </div>
      </div>
      <div className="wallet-actions">
        {!FACTORY_ADDRESS && (
          <span className="factory-warning">⚠ No factory address</span>
        )}
        {account ? (
          <>
            <span className="account">{shortAddr(account)}</span>
            <button className="btn-secondary" onClick={disconnect}>Disconnect</button>
          </>
        ) : (
          <button className="btn-shimmer" onClick={connect}>Connect Wallet</button>
        )}
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing gets its own full-width layout — no .container wrapper */}
      <Route path="/landing" element={<Landing />} />
      <Route path="*" element={
        <div className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateProject />} />
            <Route path="/project/:address" element={<ProjectDetail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/landing" replace />} />
          </Routes>
        </div>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <Navbar />
        <AppRoutes />
        <footer className="app-footer">
          <div className="footer-inner">
            <span className="footer-brand">⛨ Aegis</span>
            <span className="footer-sep">·</span>
            <span>Milestone-Based Crowdfunding on Ethereum</span>
            <span className="footer-sep">·</span>
            <Link to="/about">About</Link>
            <span className="footer-sep">·</span>
            <Link to="/create">Create Project</Link>
          </div>
        </footer>
      </BrowserRouter>
    </Web3Provider>
  );
}
