// Provider adapter contract. Server-only consumers (registry, routes) — the
// interface itself is type-only and safe anywhere.
import type {
  ExternalCandidate,
  ProviderSearchResult,
  RevealResult,
  SourcingFilters,
  VerifyResult,
} from "./types";

export type ProviderKey = "mock" | "pdl" | "apollo";

export interface ProviderCallOpts {
  apiKey: string;
  timeoutMs: number;
}

export interface CandidateRef {
  providerRecordId?: string;
  linkedinUrl?: string | null;
  email?: string | null;
}

export interface SourcingProvider {
  key: ProviderKey;
  name: string;
  capabilities: {
    searchCandidates: true;
    countCandidates?: boolean; // cheap match-count estimate before spending credits
    searchCompanies?: boolean; // Phase 2
    enrichCandidate?: boolean;
    revealContact?: boolean;
  };

  searchCandidates(
    filters: SourcingFilters,
    opts: ProviderCallOpts & { limit: number; offset?: number },
  ): Promise<ProviderSearchResult>;

  // Total matches for the current filters WITHOUT retrieving (or paying for)
  // records. Powers the live "X candidates match" banner.
  countCandidates?(filters: SourcingFilters, opts: ProviderCallOpts): Promise<number | null>;

  enrichCandidate?(ref: CandidateRef, opts: ProviderCallOpts): Promise<ExternalCandidate | null>;

  revealContact?(
    ref: CandidateRef,
    type: "email" | "phone",
    opts: ProviderCallOpts,
  ): Promise<RevealResult>;
}

export interface EmailVerifier {
  key: string;
  verify(email: string, opts: { apiKey: string; timeoutMs: number }): Promise<VerifyResult>;
}
