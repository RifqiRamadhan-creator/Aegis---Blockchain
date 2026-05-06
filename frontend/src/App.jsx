import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Web3Provider, useWeb3 } from "./context/Web3Context";
import Home from "./pages/Home";
import CreateProject from "./pages/CreateProject";
import ProjectDetail from "./pages/ProjectDetail";
import { shortAddr } from "./utils/formatters";

function Navbar() {
  const { account, connect, disconnect, FACTORY_ADDRESS } = useWeb3();
  return (
    <nav>
      <div className="flex">
        <span className="logo">⛨ Aegis</span>
        <Link to="/" style={{ marginLeft: "1.5rem" }}>Projects</Link>
        <Link to="/create" style={{ marginLeft: "1rem" }}>Create</Link>
      </div>
      <div className="flex">
        {!FACTORY_ADDRESS && (
          <span className="error" style={{ marginRight: "0.5rem" }}>
            No factory address — set VITE_FACTORY_ADDRESS
          </span>
        )}
        {account ? (
          <>
            <span className="account">{shortAddr(account)}</span>
            <button className="btn-secondary" onClick={disconnect}>Disconnect</button>
          </>
        ) : (
          <button onClick={connect}>Connect Wallet</button>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <Navbar />
        <div className="container" style={{ paddingTop: "1.5rem" }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateProject />} />
            <Route path="/project/:address" element={<ProjectDetail />} />
          </Routes>
        </div>
      </BrowserRouter>
    </Web3Provider>
  );
}
