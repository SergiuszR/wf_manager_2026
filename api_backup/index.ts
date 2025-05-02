// This file is a copy of items.ts, renamed to index.ts for Vercel routing.
// ... existing code from items.ts ... 

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
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }
  try {
    const { collectionId } = req.query;
    if (!collectionId || typeof collectionId !== 'string') {
      res.status(400).json({ message: 'Collection ID is required' });
      return;
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }
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
    
    res.status(200).json({ items: processedItems, total: response.data.total || items.length, offset: response.data.offset || 0 });
  } catch (error: any) {
    console.error('Error fetching collection items:', error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data));
    }
    res.status(500).json({ message: 'Failed to fetch collection items', error: error.message });
  }
} 