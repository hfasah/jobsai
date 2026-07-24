import { siteBanner } from "./siteBanner";
import { landingPage } from "./landingPage";
import { homePage, pricingCopy } from "./siteCopy";
import { heroBlock, richTextBlock, featureGridBlock, faqListBlock, ctaBlock, bookingBlock, leadFormBlock, ghlEmbedBlock } from "./blocks";

export const schemaTypes = [
  // documents
  siteBanner,
  landingPage,
  homePage,
  pricingCopy,
  // blocks (the whitelist marketing composes pages from)
  heroBlock,
  richTextBlock,
  featureGridBlock,
  faqListBlock,
  ctaBlock,
  bookingBlock,
  leadFormBlock,
  ghlEmbedBlock,
];
