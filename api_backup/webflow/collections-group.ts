import { VercelRequest, VercelResponse } from '@vercel/node';
import collectionsApiHandler from './collections-api';
import collectionsHandler from './collections';
import collectionIdHandler from './collections/[collectionId]';
import itemsIndexHandler from './collections/[collectionId]/items/index';
import itemIdHandler from './collections/[collectionId]/items/[itemId]';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS requests directly
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');

  console.log(`Handling collections request: ${req.method} ${url}`);

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
    
    // /api/webflow/collections-api
    if (path.includes('/collections-api')) {
      console.log('Handling collections-api request');
      return collectionsApiHandler(req, res);
    }
    
    // /api/webflow/collections
    if (path.endsWith('/collections')) {
      console.log('Handling collections list request');
      return collectionsHandler(req, res);
    }
    
    // Extract collection ID and further path components
    const collectionsIndex = pathComponents.indexOf('collections');
    if (collectionsIndex === -1 || collectionsIndex >= pathComponents.length - 1) {
      console.log('Invalid collections path:', path);
      return res.status(404).send('Invalid collections path');
    }
    
    const collectionId = pathComponents[collectionsIndex + 1];
    
    // /api/webflow/collections/:collectionId/items/:itemId
    if (path.includes(`/collections/${collectionId}/items/`)) {
      const itemsIndex = pathComponents.indexOf('items');
      if (itemsIndex !== -1 && itemsIndex < pathComponents.length - 1) {
        const itemId = pathComponents[itemsIndex + 1];
        console.log(`Handling collection item request for collection ${collectionId}, item ${itemId}`);
        req.query.collectionId = collectionId;
        req.query.itemId = itemId;
        return itemIdHandler(req, res);
      }
    }
    
    // /api/webflow/collections/:collectionId/items
    if (path.endsWith(`/collections/${collectionId}/items`)) {
      console.log(`Handling collection items list request for collection ${collectionId}`);
      req.query.collectionId = collectionId;
      return itemsIndexHandler(req, res);
    }
    
    // /api/webflow/collections/:collectionId
    console.log(`Handling collection details request for collection ${collectionId}`);
    req.query.collectionId = collectionId;
    return collectionIdHandler(req, res);
  } catch (error) {
    console.error('Error handling collections request:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 