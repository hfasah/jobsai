# Connecting Your CRM to JobsAI

JobsAI can push your recruiting CRM — **companies and contacts** — into your external
sales CRM so both teams work from one set of records, with no double data entry.
**Pipedrive** is supported today; HubSpot, Salesforce, Zoho and others are available on
request.

## How it works at a glance

- **Direction:** one-way — **JobsAI → your CRM**. JobsAI never deletes or overwrites
  unrelated data in your CRM.
- **Deduplicated:** each JobsAI record is keyed to its CRM object, so updates modify the
  **same** record instead of creating duplicates.
- **Automatic + on-demand:** new and edited records sync in the background; a **Sync now**
  button pushes everything at once.

## Before you start

- Your plan includes the **CRM module** (Agency, Business, or Enterprise).
- You're an **Owner or Admin** of the JobsAI workspace (only they can connect a CRM).
- You have access to your CRM's **API settings**.

---

## Connecting Pipedrive

**1. Get your Pipedrive API token**
In Pipedrive, go to **Settings → Personal preferences → API** and copy your **personal
API token**. *(Optional)* Note your company domain — the `acme` in `acme.pipedrive.com`.

**2. Connect in JobsAI**
Go to **Settings → Integrations → Pipedrive CRM**. Paste the **API token** (and the
**company domain** if you have one) and click **Connect**. JobsAI validates the token
immediately — a wrong token fails right away, so you'll know it worked.

**3. Run the first sync**
Click **Sync now** to push your existing companies and contacts in one pass. After that,
every create and edit syncs automatically.

---

## What syncs

| JobsAI  | →   | Pipedrive        | Fields                                                  |
| ------- | --- | ---------------- | ------------------------------------------------------ |
| Company | →   | **Organization** | Name, address (from location)                          |
| Contact | →   | **Person**       | Name, email, phone — **linked to its Organization**    |

When you push a contact whose company hasn't synced yet, JobsAI **creates the
Organization first**, then attaches the Person to it — so your Pipedrive structure stays
clean.

The Integrations card shows live status: **Companies synced X/Y**, **Contacts synced
X/Y**, and the **last full sync** time.

## When does it sync?

- **Automatically** — whenever you add or edit a company or contact in the JobsAI CRM
  (runs in the background; never slows you down).
- **Manually** — **Sync now** re-pushes everything (use after a bulk import, or to
  backfill). A single run processes up to 500 of each; run it again for larger datasets.

## Disconnecting

**Settings → Integrations → Pipedrive CRM → Disconnect** stops syncing but **keeps the
record links** — so if you reconnect later, JobsAI updates the same Pipedrive objects
rather than duplicating them.

---

## Troubleshooting

- **"Couldn't connect to Pipedrive"** — the API token is wrong or expired. Re-copy it
  from Pipedrive → Settings → Personal preferences → API.
- **Records aren't appearing** — confirm the integration shows **Connected**, then click
  **Sync now**. Check you're an Owner/Admin.
- **A contact isn't under its company** — make sure the contact has a **company** set in
  JobsAI; contacts without one sync as standalone Persons.
- **Counts look low after Sync now** — a full sync processes up to 500 of each per run;
  run it again for very large datasets.

---

## Adding a different CRM

Every CRM connection follows the same shape: **authenticate** (an API token, or OAuth
where supported) under **Settings → Integrations**, then JobsAI pushes your companies and
contacts and keeps them current. Onboarding a new CRM is mostly **mapping that CRM's
organization/person objects** to JobsAI's companies and contacts.

To request **HubSpot, Salesforce, Zoho**, or another CRM — or to ask for **two-way
sync**, or for **deals and activities** to push as well — contact us with your workflow
and we'll scope it. These are on the roadmap.

## Not yet supported

Deals → CRM Deals · Activities → CRM Activities · two-way sync · OAuth "Connect" button
(Pipedrive uses an API token today).

---

## For developers

- **Auth + storage:** the per-org API token lives in `enterprise_integrations`
  (`provider = 'pipedrive'`, `api_key` = token, `subdomain` = company domain).
- **Mapping table:** `crm_pipedrive_links` (migration `122`) keys each JobsAI entity
  (`entity_type` = `company` | `contact`) to its `pipedrive_id`, deduping create vs.
  update. Disconnect keeps the links so reconnect updates rather than duplicates.
- **Client:** `web/src/lib/pipedrive.ts` — `pushCompanyToPipedrive`,
  `pushContactToPipedrive`, `pushAllCompanies`, `pushAllContacts`, `syncAllToPipedrive`.
- **Real-time:** the CRM `companies` and `contacts` create/update routes call the push
  via `after()` (a no-op when no integration is connected).
- **Routes:** `GET/POST/DELETE /api/enterprise/integrations/pipedrive` (status / connect
  / disconnect) and `POST /api/enterprise/integrations/pipedrive/sync` ("Sync now"),
  gated behind the `crm` feature + owner/admin.
- **Adding a CRM:** implement a sibling client + push functions, reuse
  `crm_pipedrive_links` (or a parallel links table), and wire the same `after()` hooks.
