import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import FactoryABI from "../../../artifacts/contracts/AegisCrowdfundFactory.sol/AegisCrowdfundFactory.json";
import ProjectABI from "../../../artifacts/contracts/AegisProject.sol/AegisProject.json";
import TokenABI from "../../../artifacts/contracts/AegisToken.sol/AegisToken.json";

const Web3Context = createContext(null);

// Default factory and token addresses — update after deploying to local node
const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS || "";
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS || "";

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [factory, setFactory] = useState(null);
  const [token, setToken] = useState(null);
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
    let tokenInstance = null;
    if (TOKEN_ADDRESS) {
      tokenInstance = new Contract(TOKEN_ADDRESS, TokenABI.abi, sgnr);
    }

    setProvider(browserProvider);
    setSigner(sgnr);
    setAccount(selectedAccount);
    setFactory(factoryInstance);
    setToken(tokenInstance);
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

  // Instantiate token contract
  useEffect(() => {
    if (!provider) return;

    try {
      const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;
      
      // Use the signer if available, fallback to provider for read-only
      const contractRunner = signer || provider; 
      
      const tokenInstance = new ethers.Contract(TOKEN_ADDRESS, TokenABI.abi, contractRunner);
      setToken(tokenInstance);
    } catch (err) {
      console.error("Failed to initialize token contract:", err);
    }
  }, [provider, signer]);

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

  const getTokenContract = useCallback(
    (address = TOKEN_ADDRESS) => {
      if (!signer || !address) return null;
      return new Contract(address, TokenABI.abi, signer);
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
        token,
        tokenAddress: TOKEN_ADDRESS,
        error,
        connect,
        disconnect,
        getProjectContract,
        getTokenContract,
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
