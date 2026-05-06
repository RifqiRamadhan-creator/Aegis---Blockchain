import { formatEther, parseEther } from "ethers";

/** Format wei to ETH with 4 decimal places */
export function fmtEth(wei) {
  return parseFloat(formatEther(wei)).toFixed(4);
}

/** Shorten an address: 0x1234…abcd */
export function shortAddr(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

/** Unix timestamp → readable date string */
export function fmtDate(ts) {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Project state enum → label */
const STATE_LABELS = ["Funding", "Active", "Completed", "Cancelled"];
const STATE_CLASSES = ["badge-funding", "badge-active", "badge-completed", "badge-cancelled"];

export function stateBadge(stateNum) {
  const i = Number(stateNum);
  return { label: STATE_LABELS[i] || "Unknown", cls: STATE_CLASSES[i] || "" };
}

/** Milestone status enum → label */
const MS_LABELS = ["Pending", "Submitted", "Approved", "Rejected"];
export function msLabel(statusNum) {
  return MS_LABELS[Number(statusNum)] || "Unknown";
}

export { parseEther };
