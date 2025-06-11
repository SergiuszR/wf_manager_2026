import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'sergiuszrozycki@icloud.com';

function isAdmin(req: VercelRequest) {
  const email = req.headers['x-admin-email'] || req.body?.adminEmail || req.query?.adminEmail;
  return email === ADMIN_EMAIL;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const users = data.users.map((u: any) => ({
    id: u.id,
    email: u.email,
    premium: u.user_metadata?.premium === true
  }));
  res.json({ users });
} 