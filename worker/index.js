// Cloudflare Worker for KNR Collective contact form
// Handles POST requests from the static site and forwards to Formspree

function sanitize(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().slice(0, 2000);
}

export default {
  async fetch(request, env) {
    // CORS headers for cross-origin requests from your site
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Update to your domain in production
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ message: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Allow': 'POST' },
      });
    }

    let body;
    try {
      body = await request.formData();
    } catch {
      return new Response(JSON.stringify({ message: 'Invalid form data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Honeypot ────────────────────────────────────────────────────────────────
    const hp = sanitize(body.get('hp_name'));
    if (hp) {
      // Silently accept to not reveal detection
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Validation ──────────────────────────────────────────────────────────────
    const name = sanitize(body.get('name'));
    const email = sanitize(body.get('email'));
    const message = sanitize(body.get('message'));
    const project = sanitize(body.get('project_type'));
    const budget = sanitize(body.get('budget'));

    if (!name) {
      return new Response(JSON.stringify({ message: 'Name is required' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ message: 'Valid email is required' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!message || message.length < 20) {
      return new Response(JSON.stringify({ message: 'Message must be at least 20 characters' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Forward to Formspree ────────────────────────────────────────────────────
    const FORMSPREE_ENDPOINT = env.FORMSPREE_ENDPOINT;
    
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (err) {
        console.error('Fetch error:', err);
        return new Response(JSON.stringify({ message: 'Network error' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // No provider configured — log and accept (dev mode)
      console.log('[contact] No FORMSPREE_ENDPOINT set. Received:', { name, email, project, budget, message });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
