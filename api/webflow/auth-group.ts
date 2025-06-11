import { VercelRequest, VercelResponse } from '@vercel/node';
import authApiHandler from '../auth-api';
import tokenApiHandler from './token-api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS requests directly
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');

  console.log(`Handling auth request: ${req.method} ${url}`);
  
  try {
    // Extract path components
    const path = url.split('?')[0]; // Remove query string
    
    // /api/webflow/token-api
    if (path.includes('/token-api')) {
      console.log('Handling token-api request');
      return tokenApiHandler(req, res);
    }
    
    // /api/auth
    if (path.includes('/auth')) {
      console.log('Handling auth request');
      return authApiHandler(req, res);
    }
    
    console.log('No matching auth endpoint found for:', path);
    return res.status(404).send('Auth endpoint not found');
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to authenticate', error: error?.message || 'Unknown error' });
  }
} 