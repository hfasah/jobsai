import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemas";

// JobsAI Marketing Studio. Engineering owns this config and the schemas
// (the block whitelist); marketing owns the documents created with them.

export default defineConfig({
  name: "jobsai-marketing",
  title: "JobsAI Marketing",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
