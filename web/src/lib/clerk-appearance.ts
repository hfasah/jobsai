export const clerkAppearance = {
  variables: {
    colorPrimary: "oklch(0.42 0.12 250)",
    colorText: "oklch(0.2 0.03 250)",
    borderRadius: "0.625rem",
  },
  elements: {
    card: "shadow-sm border border-border",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton: "border-border",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90",
  },
} as const;

// Enterprise sign-in: email-only — no Google / social login. Members must sign
// in with the exact email their invite was sent to, so a random Google account
// can never land in a company workspace.
export const enterpriseAppearance = {
  variables: {
    colorPrimary: "oklch(0.42 0.12 250)",
    colorText: "oklch(0.2 0.03 250)",
    borderRadius: "0.625rem",
  },
  elements: {
    card: "shadow-sm border border-border",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted-foreground",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    // Hide Google / all social connections + the "or" divider
    socialButtonsRoot: "hidden",
    socialButtonsBlockButton: "hidden",
    socialButtonsIconButton: "hidden",
    dividerRow: "hidden",
    dividerText: "hidden",
  },
} as const;
