import { Request, Response, RequestHandler } from 'express';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'sergiuszrozycki@icloud.com';

function isAdmin(req: any) {
  const email = req.headers['x-admin-email'] || req.body.adminEmail || req.query.adminEmail;
  return email === ADMIN_EMAIL;
}

export const adminListUsers: RequestHandler = async (req, res) => {
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
  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
    premium: u.user_metadata?.premium === true
  }));
  res.json({ users });
};

export const adminTogglePremium: RequestHandler = async (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { id } = req.params;
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
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: { premium }
  });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ id: data.user.id, email: data.user.email, premium: data.user.user_metadata?.premium === true });
}; 