import { VercelRequest, VercelResponse } from '@vercel/node';
import assetsApiHandler from './assets-api';
import assetIdHandler from './assets/[assetId]';
import siteAssetsHandler from './sites/[siteId]/assets';
import siteAssetsCsvHandler from './sites/[siteId]/assets/csv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS requests directly
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');

  console.log(`Handling assets request: ${req.method} ${url}`);

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
    
    // /api/webflow/assets-api
    if (path.includes('/assets-api')) {
      console.log('Handling assets-api request');
      return assetsApiHandler(req, res);
    }
    
    // /api/webflow/assets/:assetId
    if (path.includes('/assets/')) {
      const assetIndex = pathComponents.indexOf('assets');
      if (assetIndex !== -1 && assetIndex < pathComponents.length - 1) {
        const assetId = pathComponents[assetIndex + 1];
        console.log(`Handling asset request for ID: ${assetId}`);
        req.query.assetId = assetId;
        return assetIdHandler(req, res);
      }
    }
    
    // /api/webflow/sites/:siteId/assets/csv
    if (path.includes('/sites/') && path.includes('/assets/csv')) {
      const siteIndex = pathComponents.indexOf('sites');
      if (siteIndex !== -1 && siteIndex < pathComponents.length - 1) {
        const siteId = pathComponents[siteIndex + 1];
        console.log(`Handling site assets CSV request for site ID: ${siteId}`);
        req.query.siteId = siteId;
        return siteAssetsCsvHandler(req, res);
      }
    }
    
    // /api/webflow/sites/:siteId/assets
    if (path.includes('/sites/') && path.includes('/assets')) {
      const siteIndex = pathComponents.indexOf('sites');
      if (siteIndex !== -1 && siteIndex < pathComponents.length - 1) {
        const siteId = pathComponents[siteIndex + 1];
        console.log(`Handling site assets request for site ID: ${siteId}`);
        req.query.siteId = siteId;
        return siteAssetsHandler(req, res);
      }
    }
    
    console.log('No matching assets endpoint found for:', path);
    return res.status(404).send('Assets endpoint not found');
  } catch (error) {
    console.error('Error handling assets request:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 