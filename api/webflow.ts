import { VercelRequest, VercelResponse } from '@vercel/node';
import sitesHandler from './webflow/sites-group';
import pagesHandler from './webflow/pages-group';
import collectionsHandler from './webflow/collections-group';
import assetsHandler from './webflow/assets-group';
import authHandler from './webflow/auth-group';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');

  try {
    const path = url.split('?')[0];
    const pathComponents = path.split('/').filter(Boolean);

    // Route any path containing 'collections' to collectionsHandler
    if (pathComponents.includes('collections')) {
      return collectionsHandler(req, res);
    }
    // Route any path containing 'pages' to pagesHandler
    if (pathComponents.includes('pages')) {
      return pagesHandler(req, res);
    }
    // Route any path containing 'sites' to sitesHandler
    if (pathComponents.includes('sites')) {
      return sitesHandler(req, res);
    }
    // Route any path containing 'assets' to assetsHandler
    if (pathComponents.includes('assets')) {
      return assetsHandler(req, res);
    }
    // Route any path containing 'auth' to authHandler
    if (pathComponents.includes('auth')) {
      return authHandler(req, res);
    }
    return res.status(404).send('Endpoint not found');
  } catch (error: any) {
    return res.status(500).send(`Server error: ${error.message}`);
  }
} 