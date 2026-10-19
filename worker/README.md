# Job search Worker

The Find jobs page calls this Worker. The website itself is static and cannot hold secret keys.

## Set up (about 15 minutes)

1. Get a key from a job source (one is enough to start):
   - **Careerjet** (has an Irish site, careerjet.ie): apply for a publisher account at careerjet.co.uk/partners and ask for an API key.
   - **Jooble**: request a key at jooble.org/api/about.
2. Deploy:
   ```
   cd worker
   npx wrangler login
   npx wrangler secret put CAREERJET_KEY     # paste the key
   npx wrangler secret put JOOBLE_KEY        # optional second source
   npx wrangler deploy
   ```
3. Check `https://jobs.cvid.app/health` lists your sources.
4. Search with a few real queries ("medical secretary Waterford") and look at the results.

Until it is deployed the Find jobs page shows quick links to job boards and still lets people paste in an advert.

## What it does and does not do

- Receives only `what` and `where` (what the visitor typed) plus the visitor's IP and browser string, which Careerjet requires.
- Never receives a CV, a name or anything from the tracker. Match scoring happens in the browser.
- Stores nothing and does not cache. Each search is live, because Careerjet credits clicks per visitor.
- The apply link in each result is the provider's own tracked link. Never rewrite, shorten or strip it, or the click will not be credited to you.
- Only answers requests from cvid.app (and localhost for testing).

## To confirm with a real key

The Careerjet and Jooble field names in `index.js` follow their public documentation as summarised by third parties. Run one live search and check the fields line up. If a field is empty, adjust the adapter. Also read each provider's terms on how results may be shown (links, logos, attribution) and update the Find jobs page to match.

Adzuna is not included: its country list does not appear to include Ireland.
