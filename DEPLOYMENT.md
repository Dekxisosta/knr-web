# Deployment Guide

## Architecture

**KNR Collective** uses a split architecture:
- **Cloudflare Pages**: Static site (HTML, CSS, JS)
- **Cloudflare Workers**: Contact API endpoint (serverless)

This keeps the Formspree endpoint hidden while keeping the site fast and static.

---

## 1. Deploy the Worker (Contact API)

### First Time Setup

1. **Install Wrangler globally** (if not installed):
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Navigate to worker directory**:
   ```bash
   cd worker
   ```

4. **Set your Formspree secret**:
   ```bash
   wrangler secret put FORMSPREE_ENDPOINT
   ```
   When prompted, paste your Formspree URL: `https://formspree.io/f/YOUR_FORM_ID`

5. **Deploy the worker**:
   ```bash
   wrangler deploy
   ```

   You'll get a URL like: `https://knr-contact-api.YOUR_SUBDOMAIN.workers.dev`

### Quick Deploy (after setup)

From project root:
```bash
npm run worker:deploy
```

---

## 2. Update Contact Form

After deploying the worker, update the contact form to use the Worker URL:

1. Open `src/components/sections/Contact.astro`
2. Find the `<form>` tag
3. Update the `action` attribute to your Worker URL:
   ```html
   <form action="https://knr-contact-api.YOUR_SUBDOMAIN.workers.dev" method="POST">
   ```

---

## 3. Deploy to Cloudflare Pages

### Via Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **Pages**
2. Your project should auto-deploy from GitHub
3. **Build settings**:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`

### Manual Deploy

```bash
npm run build
npx wrangler pages deploy dist
```

---

## 4. (Optional) Custom Domain for Worker

To use `knrcollective.com/api/contact` instead of the worker subdomain:

1. Edit `worker/wrangler.toml`:
   ```toml
   [env.production]
   routes = ["knrcollective.com/api/*"]
   ```

2. Deploy with production environment:
   ```bash
   cd worker
   wrangler deploy --env production
   ```

3. Update your form action to `/api/contact` (relative URL)

---

## Environment Variables

### Worker Secrets
- `FORMSPREE_ENDPOINT`: Your Formspree form URL (set via `wrangler secret put`)

### Site Environment Variables
None required for production (static site)

---

## Testing

### Test Worker Locally
```bash
cd worker
wrangler dev
```

### Test Site Locally
```bash
npm run dev
```

Make sure to update the form action to point to your local worker (`http://localhost:8787`) for testing.

---

## Troubleshooting

**Worker not receiving requests:**
- Check CORS is enabled (it is by default in `worker/index.js`)
- Verify the form action URL matches your deployed worker
- Check browser console for CORS errors

**Formspree not working:**
- Verify secret is set: `cd worker && wrangler secret list`
- Check worker logs: `cd worker && wrangler tail`

**Pages deployment failing:**
- Ensure build output is `dist` (not `dist/client`)
- Check Node version matches `package.json` engines
