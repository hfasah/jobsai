import { defineField, defineType } from "sanity";

// Copy overrides for the real site pages (Phase 3). Create ONE document of
// each type. Every field is optional: anything left empty keeps the site's
// built-in copy, so partial edits are safe. Prices, plan names, and limits are
// deliberately NOT here — they come from the billing system and cannot drift.

export const homePage = defineType({
  name: "homePage",
  title: "Home page copy",
  type: "document",
  description: "Overrides for app.jobsai.work/enterprise/home. Empty fields keep the current site copy.",
  fields: [
    defineField({ name: "heroHeading", title: "Hero heading", type: "string", description: "Currently: The AI-Powered Talent Acquisition Operating System" }),
    defineField({ name: "heroSubheading", title: "Hero subheading", type: "text", rows: 2 }),
    defineField({ name: "trialNote", title: "Trial note", type: "string", description: "Currently: All plans include a 14-day free trial." }),
    defineField({ name: "featuresHeading", title: "Features section heading", type: "string" }),
    defineField({ name: "featuresSubheading", title: "Features section subheading", type: "string" }),
    defineField({
      name: "features", title: "Feature cards", type: "array",
      description: "Replaces ALL nine feature cards when set. Leave empty to keep the current cards. Icons stay as designed.",
      of: [{
        type: "object",
        fields: [
          defineField({ name: "name", title: "Name", type: "string" }),
          defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
        ],
      }],
    }),
  ],
  preview: { prepare: () => ({ title: "Home page copy" }) },
});

export const pricingCopy = defineType({
  name: "pricingCopy",
  title: "Pricing page copy",
  type: "document",
  description: "Overrides for app.jobsai.work/enterprise/pricing. Copy only — prices and plan names come from the billing system.",
  fields: [
    defineField({ name: "heroHeading", title: "Hero heading", type: "string" }),
    defineField({ name: "heroSubheading", title: "Hero subheading", type: "string" }),
    defineField({ name: "trialNote", title: "Trial note", type: "string" }),
    defineField({
      name: "faqs", title: "FAQ", type: "array",
      description: "Replaces ALL pricing FAQs when set (also feeds the FAQ data search engines see). Leave empty to keep the current FAQs.",
      of: [{
        type: "object",
        fields: [
          defineField({ name: "q", title: "Question", type: "string" }),
          defineField({ name: "a", title: "Answer", type: "text", rows: 3 }),
        ],
        preview: { select: { title: "q" } },
      }],
    }),
  ],
  preview: { prepare: () => ({ title: "Pricing page copy" }) },
});
