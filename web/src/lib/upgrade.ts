// Fire-from-anywhere upgrade prompt. Any client code can call promptUpgrade(reason)
// to open the global UpgradePlansModal (mounted once by <UpgradeHost/>), so every
// paid wall offers one-click buying without each component wiring its own modal.

export const UPGRADE_EVENT = "jobsai:upgrade";

export function promptUpgrade(reason?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail: reason ?? null }));
  }
}

// Open the Buy Tokens modal (top-up packs) — for "out of tokens" walls where the
// user just wants more tokens, not a plan change.
export const BUY_TOKENS_EVENT = "jobsai:buy-tokens";

export function promptBuyTokens(reason?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BUY_TOKENS_EVENT, { detail: reason ?? null }));
  }
}
