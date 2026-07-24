import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { schemaTypes } from "./schemas";

// JobsAI Marketing Studio. Engineering owns this config and the schemas
// (the block whitelist); marketing owns the documents created with them.

export default defineConfig({
  name: "jobsai-marketing",
  title: "JobsAI Marketing",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [
    structureTool(),
    // Visual editing: live preview of the real site (with desktop/mobile
    // viewport toggle) showing DRAFTS before publish. The enable URL turns on
    // the app's draft mode; the site allows the studio origin via CSP
    // frame-ancestors.
    presentationTool({
      previewUrl: {
        origin: "https://app.jobsai.work",
        preview: "/enterprise/home",
        previewMode: {
          enable: `/api/preview?secret=${process.env.SANITY_STUDIO_PREVIEW_SECRET || ""}`,
        },
      },
    }),
  ],
  schema: { types: schemaTypes },
});
