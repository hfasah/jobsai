// Fire-from-anywhere upgrade prompt. Any client code can call promptUpgrade(reason)
// to open the global UpgradePlansModal (mounted once by <UpgradeHost/>), so every
// paid wall offers one-click buying without each component wiring its own modal.

export const UPGRADE_EVENT = "jobsai:upgrade";

export function promptUpgrade(reason?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail: reason ?? null }));
  }
}
