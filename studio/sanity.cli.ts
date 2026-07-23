import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || "",
    dataset: process.env.SANITY_STUDIO_DATASET || "production",
  },
  // Hosted studio URL: https://jobsai-marketing.sanity.studio
  studioHost: "jobsai-marketing",
  deployment: { appId: "evtaslnqjvn66lnfo2a5uc0z" },
});
