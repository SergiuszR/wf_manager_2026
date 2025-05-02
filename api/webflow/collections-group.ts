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
        const enhancedCollections = collections.map(collection => ({
          ...collection,
          siteName: site.displayName || site.shortName,
          siteId: site.id,
          designerUrl: `https://webflow.com/design/${site.id}/collections/${collection.id}`
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

async function getCollectionDetails(req: VercelRequest, res: VercelResponse, collectionId: string, webflowToken: string) {
  try {
    const response = await axios.get(`https://api.webflow.com/v2/collections/${collectionId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    // Log the Webflow API response for debugging
    console.log('Webflow API collection details response:', response.data);
    // Always return a 'collection' object with a 'fields' array
    const collection = response.data.collection || response.data;
    if (!collection.fields || !Array.isArray(collection.fields) || collection.fields.length === 0) {
      return res.status(200).json({
        collection: { ...collection, fields: [] },
        warning: 'No fields found in collection details. Check your Webflow API response and permissions.'
      });
    }
    res.status(200).json({ collection });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch collection details', error: error.message });
  }
}

async function getCollectionItems(req: VercelRequest, res: VercelResponse, collectionId: string, webflowToken: string) {
  try {
    // Fetch staged (all) items
    const stagedRes = await axios.get(`https://api.webflow.com/beta/collections/${collectionId}/items`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    const stagedItems = stagedRes.data.items || [];
    const stagedTotal = stagedRes.data.pagination?.total ?? stagedItems.length;
    // Fetch live (published) items
    const liveRes = await axios.get(`https://api.webflow.com/v2/collections/${collectionId}/items/live`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    const liveItems = liveRes.data.items || [];
    const liveTotal = liveRes.data.pagination?.total ?? liveItems.length;
    // Process items for UI (use staged items for the list)
    const processedItems = stagedItems.map((item: any) => {
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
        ...item.fieldData
      };
      return processedItem;
    });
    res.status(200).json({ 
      items: processedItems, 
      total: stagedTotal,
      stagedCount: stagedTotal,
      liveCount: liveTotal,
      offset: stagedRes.data.pagination?.offset || 0 
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch collection items', error: error.message });
  }
}

async function getCollectionItem(req: VercelRequest, res: VercelResponse, collectionId: string, itemId: string, webflowToken: string) {
  try {
    const response = await axios.get(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch collection item', error: error.message });
  }
}

async function updateCollectionItem(req: VercelRequest, res: VercelResponse, collectionId: string, itemId: string, webflowToken: string) {
  try {
    const { fieldData, isDraft, isArchived, cmsLocaleId } = req.body;
    const patchBody: any = { fieldData };
    if (typeof isDraft === 'boolean') patchBody.isDraft = isDraft;
    if (typeof isArchived === 'boolean') patchBody.isArchived = isArchived;
    if (cmsLocaleId) patchBody.cmsLocaleId = cmsLocaleId;
    const response = await axios.patch(
      `https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`,
      patchBody,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`,
          'Accept-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update collection item', error: error.message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const path = url.split('?')[0];
    const pathComponents = path.split('/').filter(Boolean);
    const webflowIndex = pathComponents.indexOf('webflow');
    if (webflowIndex === -1) {
      return res.status(404).send('Not found: Invalid path structure');
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }
    // /api/webflow/collections
    if (path.endsWith('/collections')) {
      return getAllCollections(req, res, webflowToken);
    }
    // /api/webflow/collections/:collectionId/items/:itemId
    const collectionsIndex = pathComponents.indexOf('collections');
    if (collectionsIndex !== -1 && collectionsIndex < pathComponents.length - 1) {
      const collectionId = pathComponents[collectionsIndex + 1];
      const itemsIndex = pathComponents.indexOf('items');
      if (itemsIndex !== -1 && itemsIndex < pathComponents.length - 1) {
        const itemId = pathComponents[itemsIndex + 1];
        if (req.method === 'GET') {
          return getCollectionItem(req, res, collectionId, itemId, webflowToken);
        } else if (req.method === 'PATCH') {
          return updateCollectionItem(req, res, collectionId, itemId, webflowToken);
        }
      }
      // /api/webflow/collections/:collectionId/items
      if (path.endsWith(`/collections/${collectionId}/items`)) {
        if (req.method === 'GET') {
          return getCollectionItems(req, res, collectionId, webflowToken);
        }
      }
      // /api/webflow/collections/:collectionId
      if (path.endsWith(`/collections/${collectionId}`)) {
        if (req.method === 'GET') {
          return getCollectionDetails(req, res, collectionId, webflowToken);
        }
      }
    }
    res.status(404).send('Collections endpoint not found');
  } catch (error: any) {
    res.status(500).send(`Server error: ${error.message}`);
  }
} 