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
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }
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
      } catch (error: any) {}
    }
    res.status(200).json({ collections: allCollections });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch collections', error: error.message });
  }
} 