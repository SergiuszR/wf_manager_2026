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
    // Fetch assets
    const response = await axios.get(
      `https://api.webflow.com/beta/sites/${siteId}/assets`,
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`
        }
      }
    );
    const assets = response.data.assets || [];
    // Generate CSV content
    const csvHeader = 'ID,Display Name,Original File Name,Content Type,Size (bytes),Hosted URL,Alt Text,Created On,Last Updated\n';
    const csvRows = assets.map((asset: any) => {
      return [
        asset.id || '',
        `"${(asset.displayName || '').replace(/"/g, '""')}"`,
        `"${(asset.originalFileName || '').replace(/"/g, '""')}"`,
        asset.contentType || '',
        asset.size != null ? asset.size : '',
        `"${asset.hostedUrl || ''}"`,
        `"${(asset.altText != null ? asset.altText : '').replace(/"/g, '""')}"`,
        asset.createdOn || '',
        asset.lastUpdated || ''
      ].join(',');
    }).join('\n');
    const csvContent = csvHeader + csvRows;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="webflow-assets-${siteId}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate CSV', error: error.message });
  }
} 