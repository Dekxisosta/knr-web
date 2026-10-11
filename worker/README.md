# KNR Contact API Worker

Cloudflare Worker that handles contact form submissions for knrcollective.com

## Setup

1. **Install Wrangler CLI** (if not already installed):
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Set the Formspree secret**:
   ```bash
   cd worker
   wrangler secret put FORMSPREE_ENDPOINT
   # Paste your Formspree URL when prompted: https://formspree.io/f/YOUR_FORM_ID
   ```

## Deploy

From the `worker/` directory:

```bash
wrangler deploy
```

This will deploy the worker and give you a URL like:
`https://knr-contact-api.YOUR_SUBDOMAIN.workers.dev`

## Update Your Site

After deployment, update your contact form in the Astro site to POST to the Worker URL instead of `/api/contact`.

## Local Development

Test locally with:
```bash
wrangler dev
```

## Production Domain

To use your custom domain (e.g., `knrcollective.com/api/contact`), add a route in `wrangler.toml`:

```toml
[env.production]
routes = ["knrcollective.com/api/*"]
```

Then deploy again with `wrangler deploy --env production`.
