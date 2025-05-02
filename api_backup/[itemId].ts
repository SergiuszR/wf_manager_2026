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
  const { collectionId, itemId } = req.query;
  if (!collectionId || typeof collectionId !== 'string' || !itemId || typeof itemId !== 'string') {
    res.status(400).json({ message: 'Collection ID and Item ID are required' });
    return;
  }
  const webflowToken = getEffectiveWebflowToken(req);
  if (!webflowToken) {
    res.status(401).json({ message: 'No Webflow token found' });
    return;
  }
  if (req.method === 'GET') {
    try {
      const response = await axios.get(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`,
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
      res.status(500).json({ message: 'Failed to fetch collection item', error: error.message });
    }
    return;
  }
  if (req.method === 'PATCH') {
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
    return;
  }
  res.status(405).json({ message: 'Method Not Allowed' });
} 