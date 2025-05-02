import { VercelRequest, VercelResponse } from '@vercel/node';
import sitesApiHandler from './sites-api';
import sitesHandler from './sites';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS requests directly
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');

  console.log(`Handling sites request: ${req.method} ${url}`);
  
  try {
    // Extract path components
    const path = url.split('?')[0]; // Remove query string
    const pathComponents = path.split('/').filter(Boolean);
    
    // Find where 'webflow' appears in the path
    const webflowIndex = pathComponents.indexOf('webflow');
    
    if (webflowIndex === -1) {
      console.log('Invalid path structure:', path);
      return res.status(404).send('Not found: Invalid path structure');
    }
    
    // /api/webflow/sites-api
    if (path.includes('/sites-api')) {
      console.log('Handling sites-api request');
      return sitesApiHandler(req, res);
    }
    
    // /api/webflow/sites
    if (path.endsWith('/sites')) {
      console.log('Handling sites list request');
      return sitesHandler(req, res);
    }
    
    // /api/webflow/sites/:siteId
    const sitesIndex = pathComponents.indexOf('sites');
    if (sitesIndex !== -1 && sitesIndex < pathComponents.length - 1) {
      const siteId = pathComponents[sitesIndex + 1];
      if (!path.includes('/assets')) { // Not an assets path, which is handled by assets-group
        console.log(`Handling site details request for site ID: ${siteId}`);
        req.query.siteId = siteId;
        return sitesHandler(req, res);
      }
    }
    
    console.log('No matching sites endpoint found for:', path);
    return res.status(404).send('Sites endpoint not found');
  } catch (error) {
    console.error('Error handling sites request:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 