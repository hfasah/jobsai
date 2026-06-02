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
