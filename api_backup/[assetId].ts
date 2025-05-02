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
    const { assetId } = req.query;
    if (!assetId || typeof assetId !== 'string') {
      res.status(400).json({ message: 'Asset ID is required' });
      return;
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }
    if (req.method === 'GET') {
      const response = await axios.get(`https://api.webflow.com/beta/assets/${assetId}`, {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      });
      res.status(200).json(response.data);
    } else if (req.method === 'PATCH') {
      const { altText, displayName } = req.body;
      if (typeof altText !== 'string' && typeof displayName !== 'string') {
        res.status(400).json({ message: 'At least one of altText or displayName is required' });
        return;
      }
      const requestBody: Record<string, string> = {};
      if (typeof altText === 'string') requestBody.altText = altText;
      if (typeof displayName === 'string') requestBody.displayName = displayName;
      const response = await axios.patch(
        `https://api.webflow.com/beta/assets/${assetId}`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      res.status(200).json(response.data);
    }
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch or update asset', error: error.message });
  }
} 