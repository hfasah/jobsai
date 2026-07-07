# Vendor / Subprocessor Management Policy

- **Owner:** Security Owner · **Approved by:** _<name>_ · **Version:** 1.0 (draft) · **Effective:** _<date>_ · **Review:** annual

## 1. Purpose
Ensure third parties that process in-scope data meet JobsAI's security and confidentiality
requirements.

## 2. Scope
All subservice organizations and vendors in `../03-vendor-inventory.md`.

## 3. Policy
- **Before onboarding** a vendor that will process personal/confidential data:
  - Review their security posture (**SOC 2 Type 2 or ISO 27001** report via their trust portal).
  - Sign a **Data Processing Agreement (DPA)** and confirm data-use terms (esp. **no
    model-training on our data** for AI vendors).
  - Record purpose, data processed, region, and CSOCs in the vendor inventory.
- **Annually** (or on material change): re-review each vendor's compliance report and DPA;
  update the inventory.
- **Offboarding:** on termination, ensure data return/deletion per the DPA.
- Maintain a public **subprocessor list** for customers.

## 4. Complementary Subservice Organization Controls (CSOCs)
JobsAI relies on subservice orgs (Vercel, Supabase, Clerk, etc.) for physical security,
infrastructure encryption, and platform availability. These are excluded from JobsAI's
description under the **carve-out method** and covered by the vendors' own reports.

## 5. Related criteria
CC9.2, CC3.3, C1.6.

## 6. Revision history
| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 draft | _<date>_ | AI assistant | Initial draft |
