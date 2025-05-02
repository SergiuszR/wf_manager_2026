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
  if (req.method === 'POST') {
    try {
      const { siteId } = req.query;
      if (!siteId || typeof siteId !== 'string') {
        res.status(400).json({ message: 'Site ID is required' });
        return;
      }
      const webflowToken = getEffectiveWebflowToken(req);
      if (!webflowToken) {
        res.status(401).json({ message: 'No Webflow token found' });
        return;
      }
      const { fileName, fileHash } = req.body;
      if (!fileName || !fileHash) {
        res.status(400).json({ message: 'fileName and fileHash are required' });
        return;
      }
      const response = await axios.post(
        `https://api.webflow.com/beta/sites/${siteId}/assets`,
        { fileName, fileHash },
        {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      res.status(200).json({
        uploadUrl: response.data.uploadUrl,
        uploadDetails: response.data.uploadDetails,
        id: response.data.id
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create asset', error: error.message });
    }
    return;
  }
  if (req.method === 'GET') {
    try {
      const { siteId } = req.query;
      if (!siteId || typeof siteId !== 'string') {
        res.status(400).json({ message: 'Site ID is required' });
        return;
      }
      const webflowToken = getEffectiveWebflowToken(req);
      if (!webflowToken) {
        res.status(401).json({ message: 'No Webflow token found' });
        return;
      }
      // Verify site exists
      const client = axios.create({
        baseURL: 'https://api.webflow.com',
        headers: {
          'Authorization': `Bearer ${webflowToken}`,
          'Accept-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
      });
      await client.get(`/v2/sites/${siteId}`);
      // Get assets from beta API
      const response = await axios.get(`https://api.webflow.com/beta/sites/${siteId}/assets`, {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      });
      res.status(200).json(response.data);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch assets', error: error.message });
    }
    return;
  }
  res.status(405).json({ message: 'Method Not Allowed' });
} 