import { siteBanner } from "./siteBanner";
import { landingPage } from "./landingPage";
import { heroBlock, richTextBlock, featureGridBlock, faqListBlock, ctaBlock, bookingBlock, leadFormBlock } from "./blocks";

export const schemaTypes = [
  // documents
  siteBanner,
  landingPage,
  // blocks (the whitelist marketing composes pages from)
  heroBlock,
  richTextBlock,
  featureGridBlock,
  faqListBlock,
  ctaBlock,
  bookingBlock,
  leadFormBlock,
];
