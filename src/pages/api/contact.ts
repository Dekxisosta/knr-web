import type { APIRoute } from 'astro';

// NOTE: This endpoint requires a server adapter (e.g. @astrojs/vercel or @astrojs/netlify)
// to run server-side at deploy time. For purely static deploys, the contact form
// falls back to Formspree's direct submission (see Contact.astro).
// To enable server-side handling, install your adapter and uncomment:
// export const prerender = false;

// Contact form endpoint
// Configured for Formspree by default. Set FORMSPREE_ENDPOINT in your .env
// to your form's POST URL (e.g. https://formspree.io/f/XXXXXXXX).
// Replace with your preferred email provider (Resend, SendGrid, etc.) as needed.

const FORMSPREE_ENDPOINT = import.meta.env.FORMSPREE_ENDPOINT as string | undefined;

function sanitize(val: FormDataEntryValue | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().slice(0, 2000);
}

export const POST: APIRoute = async ({ request }) => {
  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Honeypot ────────────────────────────────────────────────────────────────
  const hp = sanitize(body.get('hp_name'));
  if (hp) {
    // Silently accept to not reveal detection
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const name    = sanitize(body.get('name'));
  const email   = sanitize(body.get('email'));
  const message = sanitize(body.get('message'));
  const project = sanitize(body.get('project_type'));
  const budget  = sanitize(body.get('budget'));

  if (!name) {
    return new Response(JSON.stringify({ message: 'Name is required' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ message: 'Valid email is required' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!message || message.length < 20) {
    return new Response(JSON.stringify({ message: 'Message must be at least 20 characters' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Forward to Formspree (or swap with your provider) ──────────────────────
  if (FORMSPREE_ENDPOINT) {
    const payload = new URLSearchParams({
      name,
      email,
      message,
      project_type: project,
      budget,
      _subject: `New inquiry from ${name}`,
    });

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: payload.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Formspree error:', text);
        return new Response(JSON.stringify({ message: 'Failed to send. Try again.' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      return new Response(JSON.stringify({ message: 'Network error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    // No provider configured — log and accept (dev mode)
    console.log('[contact] No FORMSPREE_ENDPOINT set. Received:', { name, email, project, budget, message });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Only POST is supported
export const GET: APIRoute = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST' } });
