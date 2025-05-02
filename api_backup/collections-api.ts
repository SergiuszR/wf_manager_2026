import type { VercelRequest, VercelResponse } from '@vercel/node';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }

    const { collectionId, itemId, operation } = req.query;
    
    // Handle different operations based on the path
    if (!collectionId) {
      // List all collections across sites
      await getAllCollections(req, res, webflowToken);
      return;
    }
    
    if (typeof collectionId !== 'string') {
      res.status(400).json({ message: 'Invalid collection ID' });
      return;
    }
    
    if (itemId) {
      if (typeof itemId !== 'string') {
        res.status(400).json({ message: 'Invalid item ID' });
        return;
      }
      
      // Handle collection item operations
      if (req.method === 'GET') {
        await getCollectionItem(req, res, collectionId, itemId, webflowToken);
        return;
      } else if (req.method === 'PATCH') {
        await updateCollectionItem(req, res, collectionId, itemId, webflowToken);
        return;
      }
    } else if (operation === 'items') {
      // Get collection items
      await getCollectionItems(req, res, collectionId, webflowToken);
      return;
    } else {
      // Get collection details
      await getCollectionDetails(req, res, collectionId, webflowToken);
      return;
    }
  } catch (error: any) {
    console.error('Error in collections API:', error.message);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
}

// Handler to get all collections across sites
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
    
    // Get all sites first
    const sitesResponse = await client.get('/v2/sites');
    const sites: any[] = sitesResponse.data.sites || [];
    
    if (sites.length === 0) {
      res.status(200).json({ collections: [], message: 'No sites found for this token' });
      return;
    }
    
    // Collect all collections across sites
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
        console.error(`Error fetching collections for site ${site.id}:`, error.message);
        // Continue to next site
      }
    }
    
    res.status(200).json({ collections: allCollections });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch collections', error: error.message });
  }
}

// Handler to get collection details
async function getCollectionDetails(req: VercelRequest, res: VercelResponse, collectionId: string, webflowToken: string) {
  try {
    const response = await axios.get(`https://api.webflow.com/v2/collections/${collectionId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch collection details', error: error.message });
  }
}

// Handler to get collection items
async function getCollectionItems(req: VercelRequest, res: VercelResponse, collectionId: string, webflowToken: string) {
  try {
    const response = await axios.get(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    
    // Process items to ensure they have name, slug, etc.
    const items = response.data.items || [];
    const processedItems = items.map((item: any) => {
      // Extract common fields
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
      
      return processedItem;
    });
    
    res.status(200).json({ 
      items: processedItems, 
      total: response.data.total || items.length, 
      offset: response.data.offset || 0 
    });
  } catch (error: any) {
    console.error('Error fetching collection items:', error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data));
    }
    res.status(500).json({ message: 'Failed to fetch collection items', error: error.message });
  }
}

// Handler to get a single collection item
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

// Handler to update a collection item
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