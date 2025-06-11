import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'sergiuszrozycki@icloud.com';

function isAdmin(req: VercelRequest) {
  const email = req.headers['x-admin-email'] || req.body?.adminEmail || req.query?.adminEmail;
  return email === ADMIN_EMAIL;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { id } = req.query;
  const { premium } = req.body;
  if (typeof premium !== 'boolean') {
    res.status(400).json({ error: 'premium must be boolean' });
    return;
  }
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id as string, {
    user_metadata: { premium }
  });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ id: data.user.id, email: data.user.email, premium: data.user.user_metadata?.premium === true });
} 