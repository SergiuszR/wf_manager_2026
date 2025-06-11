import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import jwt from 'jsonwebtoken';

function getEffectiveWebflowToken(req: VercelRequest): string | null {
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  if (headerToken) return headerToken;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg==';
        jwt.verify(token, secret);
      } catch (e) {}
    }
  }
  return null;
}

async function getAllCollections(req: VercelRequest, res: VercelResponse, webflowToken: string) {
  try {
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    const sitesResponse = await client.get('/v2/sites');
    const sites: any[] = sitesResponse.data.sites || [];
    if (sites.length === 0) {
      res.status(200).json({ collections: [], message: 'No sites found for this token' });
      return;
    }
    let allCollections: any[] = [];
    for (const site of sites) {
      try {
        const collectionsResponse = await client.get(`/v2/sites/${site.id}/collections`);
        const collections: any[] = collectionsResponse.data?.collections || [];
        const enhancedCollections: any[] = collections.map((collection: any) => ({
          ...collection,
          siteName: site.displayName || site.shortName,
          siteId: site.id,
          previewUrl: `https://webflow.com/design/${site.id}/cms/collection/${collection.id}`,
        }));
        allCollections = [...allCollections, ...enhancedCollections];
      } catch (error: any) {
        // Continue to next site
      }
    }
    res.status(200).json({ collections: allCollections });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch collections', error: error.message });
  }
}

async function getCollectionItems(req: VercelRequest, res: VercelResponse, collectionId: string, webflowToken: string) {
  try {
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });

    // Get collection items directly using the v2 API endpoint
    const itemsResponse = await client.get(`/v2/collections/${collectionId}/items`);
    
    // Process items to ensure they have name, slug, etc.
    const items = itemsResponse.data.items || [];
    const processedItems = items.map((item: any) => ({
      id: item.id,
      name: item.fieldData?.name || item.fieldData?.title || item.fieldData?.slug || 'Unnamed Item',
      slug: item.fieldData?.slug || '',
      status: item.isDraft ? 'draft' : 'published',
      updated: item.lastUpdated || '',
      created: item.createdOn || '',
      publishedOn: item.publishedOn || '',
      isDraft: item.isDraft === true,
      isArchived: item.isArchived === true,
      // Include all fieldData for editing
      ...item.fieldData
    }));
    
    return res.status(200).json({ 
      items: processedItems,
      total: itemsResponse.data.total || items.length,
      offset: itemsResponse.data.offset || 0
    });
  } catch (error: any) {
    console.error('Error in getCollectionItems:', error);
    if (error.response) {
      // Pass through the status code from Webflow API
      return res.status(error.response.status).json({ 
        message: error.response.status === 404 ? 'Collection not found' : 'Failed to fetch collection items',
        error: error.response.data 
      });
    } else {
      return res.status(500).json({ 
        message: 'Failed to fetch collection items', 
        error: error.message 
      });
    }
  }
}

async function getCollectionItem(req: VercelRequest, res: VercelResponse, collectionId: string, itemId: string, webflowToken: string) {
  try {
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });

    // Get collection item directly using the v2 API endpoint
    const itemResponse = await client.get(`/v2/collections/${collectionId}/items/${itemId}`);
    
    // Process the item to ensure consistent format
    const item = itemResponse.data;
    const processedItem = {
      id: item.id,
      name: item.fieldData?.name || item.fieldData?.title || item.fieldData?.slug || 'Unnamed Item',
      slug: item.fieldData?.slug || '',
      status: item.isDraft ? 'draft' : 'published',
      updated: item.lastUpdated || '',
      created: item.createdOn || '',
      publishedOn: item.publishedOn || '',
      isDraft: item.isDraft === true,
      isArchived: item.isArchived === true,
      // Include all fieldData for editing
      ...item.fieldData
    };
    
    return res.status(200).json(processedItem);
  } catch (error: any) {
    console.error('Error in getCollectionItem:', error);
    if (error.response) {
      // Pass through the status code from Webflow API
      return res.status(error.response.status).json({ 
        message: error.response.status === 404 ? 'Collection or item not found' : 'Failed to fetch collection item',
        error: error.response.data 
      });
    } else {
      return res.status(500).json({ 
        message: 'Failed to fetch collection item', 
        error: error.message 
      });
    }
  }
}

async function getCollectionDetails(req: VercelRequest, res: VercelResponse, collectionId: string, webflowToken: string) {
  try {
    const client = axios.create({
      baseURL: 'https://api.webflow.com',
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });

    // Get collection details directly using the v2 API endpoint
    const detailsResponse = await client.get(`/v2/collections/${collectionId}`);
    
    // Get the actual item counts
    let stagedItemCount = detailsResponse.data.itemCount || 0;
    let liveItemCount = 0;
    
    try {
      // Get staged items count
      const stagedItemsResponse = await client.get(`/v2/collections/${collectionId}/items?limit=100`);
      if (stagedItemsResponse.data && stagedItemsResponse.data.items) {
        stagedItemCount = stagedItemsResponse.data.items.length;
      }
      
      // Get live items count
      const liveItemsResponse = await client.get(`/v2/collections/${collectionId}/items/live?limit=100`);
      if (liveItemsResponse.data && liveItemsResponse.data.items) {
        liveItemCount = liveItemsResponse.data.items.length;
      }
    } catch (itemsError: any) {
      console.error('Error fetching item counts:', itemsError.message);
      // Continue with default counts
    }
    
    // Combine the collection data with updated item counts
    const collectionData = {
      ...detailsResponse.data,
      stagedItemCount,
      liveItemCount,
      itemCount: stagedItemCount // Maintain backward compatibility
    };
    
    return res.status(200).json({ collection: collectionData });
  } catch (error: any) {
    console.error('Error in getCollectionDetails:', error);
    if (error.response) {
      // Pass through the status code from Webflow API
      return res.status(error.response.status).json({ 
        message: error.response.status === 404 ? 'Collection not found' : 'Failed to fetch collection details',
        error: error.response.data 
      });
    } else {
      return res.status(500).json({ 
        message: 'Failed to fetch collection details', 
        error: error.message 
      });
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[COLLECTIONS-GROUP] ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const path = url.split('?')[0];
    const pathComponents = path.split('/').filter(Boolean);
    console.log(`[COLLECTIONS-GROUP] Path components:`, pathComponents);
    
    const webflowIndex = pathComponents.indexOf('webflow');
    if (webflowIndex === -1) {
      console.log(`[COLLECTIONS-GROUP] No 'webflow' found in path:`, path);
      return res.status(404).send('Not found: Invalid path structure');
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      console.log(`[COLLECTIONS-GROUP] No webflow token found`);
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }

    // /api/webflow/collections/:collectionId/items/:itemId
    const collectionsIndex = pathComponents.indexOf('collections');
    console.log(`[COLLECTIONS-GROUP] Collections index:`, collectionsIndex, 'Total components:', pathComponents.length);
    
    if (collectionsIndex !== -1 && collectionsIndex < pathComponents.length - 1) {
      const collectionId = pathComponents[collectionsIndex + 1];
      console.log(`[COLLECTIONS-GROUP] Collection ID:`, collectionId);
      
      // Handle collection details request
      if (collectionsIndex + 2 === pathComponents.length) {
        console.log(`[COLLECTIONS-GROUP] Getting collection details for:`, collectionId);
        return getCollectionDetails(req, res, collectionId, webflowToken);
      }

      if (pathComponents[collectionsIndex + 2] === 'items') {
        console.log(`[COLLECTIONS-GROUP] Items request detected`);
        // Check if there's an item ID
        if (collectionsIndex + 3 < pathComponents.length) {
          const itemId = pathComponents[collectionsIndex + 3];
          console.log(`[COLLECTIONS-GROUP] Getting single item:`, itemId);
          return getCollectionItem(req, res, collectionId, itemId, webflowToken);
        }
        console.log(`[COLLECTIONS-GROUP] Getting all items for collection:`, collectionId);
        return getCollectionItems(req, res, collectionId, webflowToken);
      }
    }

    // /api/webflow/collections
    if (path.endsWith('/collections')) {
      console.log(`[COLLECTIONS-GROUP] Getting all collections`);
      return getAllCollections(req, res, webflowToken);
    }

    console.log(`[COLLECTIONS-GROUP] No matching route found for:`, path);
    res.status(404).send('Collections endpoint not found');
  } catch (error: any) {
    console.error(`[COLLECTIONS-GROUP] Error:`, error.message);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 