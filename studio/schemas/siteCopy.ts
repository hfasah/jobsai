import { defineField, defineType } from "sanity";

// Copy overrides for the real site pages (Phase 3). Create ONE document of
// each type. Every field is optional: anything left empty keeps the site's
// built-in copy, so partial edits are safe. Prices, plan names, and limits are
// deliberately NOT here — they come from the billing system and cannot drift.

const cta = (name: string, title: string) =>
  defineField({
    name, title, type: "object",
    fields: [
      defineField({ name: "label", title: "Button text", type: "string" }),
      defineField({ name: "href", title: "Button link", type: "string" }),
    ],
  });

const namedCards = (name: string, title: string, description: string) =>
  defineField({
    name, title, type: "array", description,
    of: [{
      type: "object",
      fields: [
        defineField({ name: "name", title: "Name", type: "string" }),
        defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
      ],
      preview: { select: { title: "name" } },
    }],
  });

const FIELDSETS = [
  { name: "hero", title: "Hero", options: { collapsible: true, collapsed: false } },
  { name: "problem", title: "Problem section", options: { collapsible: true, collapsed: true } },
  { name: "featuresSection", title: "Features section", options: { collapsible: true, collapsed: true } },
  { name: "solutionsSection", title: "Solutions section", options: { collapsible: true, collapsed: true } },
  { name: "interview", title: "Interview automation section", options: { collapsible: true, collapsed: true } },
  { name: "ats", title: "ATS integration section", options: { collapsible: true, collapsed: true } },
  { name: "roiWhy", title: "ROI + Why sections", options: { collapsible: true, collapsed: true } },
  { name: "finalCta", title: "Final call to action", options: { collapsible: true, collapsed: true } },
];

export const homePage = defineType({
  name: "homePage",
  title: "Home page copy",
  type: "document",
  description: "The full text of app.jobsai.work/enterprise/home. Empty fields keep the site's built-in copy. Layout and design stay as built.",
  fieldsets: FIELDSETS,
  fields: [
    // Hero
    defineField({ name: "heroHeading", title: "Hero heading", type: "string", fieldset: "hero" }),
    defineField({ name: "heroSubheading", title: "Hero subheading", type: "text", rows: 2, fieldset: "hero" }),
    defineField({ name: "trialNote", title: "Trial note", type: "string", fieldset: "hero" }),
    { ...cta("heroPrimaryCta", "Primary button"), fieldset: "hero" },
    { ...cta("heroSecondaryCta", "Second button"), fieldset: "hero" },
    { ...cta("heroTertiaryCta", "Third button"), fieldset: "hero" },
    // Problem
    defineField({ name: "problemEyebrow", title: "Small label", type: "string", fieldset: "problem" }),
    defineField({ name: "problemHeading", title: "Heading", type: "string", fieldset: "problem" }),
    defineField({ name: "problemText", title: "Text", type: "text", rows: 2, fieldset: "problem" }),
    defineField({ name: "problemBadge", title: "Badge text", type: "string", fieldset: "problem" }),
    // Features
    defineField({ name: "featuresHeading", title: "Heading", type: "string", fieldset: "featuresSection" }),
    defineField({ name: "featuresSubheading", title: "Subheading", type: "string", fieldset: "featuresSection" }),
    { ...namedCards("features", "Feature cards", "The nine feature cards. Icons stay as designed."), fieldset: "featuresSection" },
    // Solutions
    defineField({ name: "solutionsHeading", title: "Heading", type: "string", fieldset: "solutionsSection" }),
    defineField({ name: "solutionsSubheading", title: "Subheading", type: "string", fieldset: "solutionsSection" }),
    { ...namedCards("solutions", "Solution cards", "The four audience cards. Icons stay as designed."), fieldset: "solutionsSection" },
    // Interview automation
    defineField({ name: "interviewEyebrow", title: "Small label", type: "string", fieldset: "interview" }),
    defineField({ name: "interviewHeading", title: "Heading", type: "string", fieldset: "interview" }),
    defineField({ name: "interviewText", title: "Text", type: "text", rows: 3, fieldset: "interview" }),
    { ...namedCards("interviewCards", "Step cards", "The three numbered cards. Icons stay as designed."), fieldset: "interview" },
    // ATS
    defineField({ name: "atsHeading", title: "Heading", type: "string", fieldset: "ats" }),
    defineField({ name: "atsText", title: "Text", type: "text", rows: 3, fieldset: "ats" }),
    defineField({ name: "atsBoxTitle", title: "Side box title", type: "string", fieldset: "ats" }),
    defineField({ name: "atsBoxText", title: "Side box text", type: "text", rows: 2, fieldset: "ats" }),
    { ...cta("atsCta", "Side box button"), fieldset: "ats" },
    // ROI + Why
    defineField({ name: "roiHeading", title: "ROI heading", type: "string", fieldset: "roiWhy" }),
    defineField({ name: "roiSubheading", title: "ROI subheading", type: "string", fieldset: "roiWhy" }),
    defineField({ name: "whyHeading", title: "Why heading", type: "string", fieldset: "roiWhy" }),
    defineField({ name: "whyText", title: "Why text", type: "text", rows: 2, fieldset: "roiWhy" }),
    defineField({ name: "platformChips", title: "Platform chips", type: "array", of: [{ type: "string" }], description: "The checkmark pills under Why.", fieldset: "roiWhy" }),
    // Final CTA
    defineField({ name: "ctaHeading", title: "Heading", type: "string", fieldset: "finalCta" }),
    defineField({ name: "ctaSubheading", title: "Subheading", type: "text", rows: 2, fieldset: "finalCta" }),
    { ...cta("ctaPrimary", "Primary button"), fieldset: "finalCta" },
    { ...cta("ctaSecondary", "Second button"), fieldset: "finalCta" },
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
