import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { BrowserProvider, Contract } from "ethers";
import FactoryABI from "../../../artifacts/contracts/AegisCrowdfundFactory.sol/AegisCrowdfundFactory.json";
import ProjectABI from "../../../artifacts/contracts/AegisProject.sol/AegisProject.json";

const Web3Context = createContext(null);

// Default factory address — update after deploying to local node
const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS || "";

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [factory, setFactory] = useState(null);
  const [error, setError] = useState("");
  const isConnected = useRef(false);

  // Helper to set up provider, signer, and factory from a given account
  const setupConnection = useCallback(async (selectedAccount) => {
    const browserProvider = new BrowserProvider(window.ethereum);
    const sgnr = await browserProvider.getSigner(selectedAccount);

    let factoryInstance = null;
    if (FACTORY_ADDRESS) {
      factoryInstance = new Contract(FACTORY_ADDRESS, FactoryABI.abi, sgnr);
    }

    setProvider(browserProvider);
    setSigner(sgnr);
    setAccount(selectedAccount);
    setFactory(factoryInstance);
    setError("");
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) {
        setError("MetaMask not found. Please install it.");
        return;
      }

      // wallet_requestPermissions forces MetaMask to show the account
      // chooser popup, even if accounts were previously authorized.
      // This ensures the user explicitly picks which account to use.
      try {
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (permErr) {
        // User rejected the prompt — abort silently
        if (permErr.code === 4001) return;
        // Other errors (e.g. unsupported method) — fall through
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) return;

      await setupConnection(accounts[0]);
      isConnected.current = true;
    } catch (e) {
      setError(e.message);
    }
  }, [setupConnection]);

  const disconnect = useCallback(() => {
    isConnected.current = false;
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setFactory(null);
    setError("");
  }, []);

  // Listen for account and chain changes in MetaMask
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (!isConnected.current) return;
      if (accounts.length === 0) {
        // User revoked access from MetaMask
        disconnect();
      } else {
        // Re-establish connection with the new account
        setupConnection(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      if (!isConnected.current) return;
      // Reload connection on chain change to get fresh provider
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts.length > 0) {
            setupConnection(accounts[0]);
          }
        });
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect, setupConnection]);

  const getProjectContract = useCallback(
    (address) => {
      if (!signer) return null;
      return new Contract(address, ProjectABI.abi, signer);
    },
    [signer]
  );

  return (
    <Web3Context.Provider
      value={{
        account,
        provider,
        signer,
        factory,
        error,
        connect,
        disconnect,
        getProjectContract,
        FACTORY_ADDRESS,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be inside Web3Provider");
  return ctx;
}
