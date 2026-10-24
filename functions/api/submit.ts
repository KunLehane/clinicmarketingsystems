/**
 * Cloudflare Pages Function: handles the clinic check and contact forms.
 *
 * Bindings (Pages -> Settings -> Variables and Secrets / Bindings):
 *   LEADS         KV namespace. Every submission is stored first, for 90 days,
 *                 so a request is never lost even if the forward step fails.
 *   LEAD_WEBHOOK  Optional. n8n webhook URL; each submission is POSTed there
 *                 as JSON and n8n emails it on.
 */

interface Env {
  LEADS?: KVNamespace;
  LEAD_WEBHOOK?: string;
}

/** Only these fields are accepted, so the form cannot be used to post anything else. */
const ALLOWED = new Set([
  'form-name', 'name', 'clinic', 'email', 'phone', 'website', 'clinic_type', 'problem', 'message',
]);

const FORMS = new Set(['clinic-check', 'contact']);
const NINETY_DAYS = 90 * 24 * 60 * 60;

const seeOther = (location: string) => new Response(null, { status: 303, headers: { Location: location } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return seeOther('/thanks/?error=1');
  }

  // Honeypot: people leave it empty, bots fill it in. Accept and discard.
  if (String(form.get('company-website') ?? '').trim() !== '') return seeOther('/thanks/');

  const rawName = String(form.get('form-name') ?? 'unknown').slice(0, 40);
  const formName = FORMS.has(rawName) ? rawName : 'unknown';
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (ALLOWED.has(key) && typeof value === 'string' && value.trim()) fields[key] = value.trim().slice(0, 2000);
  }
  if (!fields.email || !fields.name || !fields.clinic || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return seeOther('/thanks/?error=1');
  }

  const record = {
    site: 'clinicmarketingsystems.com',
    form: formName,
    receivedAt: new Date().toISOString(),
    country: (request as { cf?: { country?: string } }).cf?.country ?? '',
    fields,
  };

  if (env.LEADS) {
    const key = `${formName}:${record.receivedAt}:${crypto.randomUUID().slice(0, 8)}`;
    try {
      await env.LEADS.put(key, JSON.stringify(record), { expirationTtl: NINETY_DAYS });
    } catch (err) {
      console.error('KV write failed', err);
    }
  } else {
    console.warn('No LEADS KV binding; submission was not stored.');
  }

  if (env.LEAD_WEBHOOK) {
    try {
      await fetch(env.LEAD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
    } catch (err) {
      console.error('Webhook send failed', err);
    }
  }

  return seeOther('/thanks/');
};

/** A GET here is someone poking at the endpoint; send them to the form. */
export const onRequestGet: PagesFunction<Env> = () => seeOther('/clinic-check/');
