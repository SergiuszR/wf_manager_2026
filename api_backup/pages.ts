import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import jwt from 'jsonwebtoken';

// Helper to get Webflow token from request
function getEffectiveWebflowToken(req: VercelRequest): string | null {
  const headerToken = req.headers['x-webflow-token'] as string | undefined;
  if (headerToken) return headerToken;
  // Support JWT in Authorization header (Bearer ...)
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || '2LAhsbAhEHiRNHQnYktVIveHIjXNrDUHA0VO5OJNHDKYzbiAETafebnH8M6EW1VrRDUgJGa9wyRMnBg0Ru/vjg==';
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === 'object' && decoded !== null && 'id' in decoded) {
          // In-memory user store is not available, so only support x-webflow-token for now
          // Optionally, fetch user from a DB here if needed
        }
      } catch (e) {
        // Ignore JWT errors
      }
    }
  }
  return null;
}

function constructPublishedUrl(siteInfo: any, page: any): string | null {
  if (!siteInfo || !page) return null;
  const domain = siteInfo.domain || null;
  if (!domain) return null;
  return `https://${domain}${page.slug === 'index' ? '' : `/${page.slug}`}`;
}

function constructPreviewUrl(siteId: string, pageId: string): string {
  return `https://webflow.com/design/${siteId}/edit/page/${pageId}`;
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
    // 1. Get all sites
    const sitesResponse = await client.get('/v2/sites');
    const sites: any[] = sitesResponse.data.sites || [];
    if (sites.length === 0) {
      res.status(200).json({ pages: [], message: 'No sites found for this token' });
      return;
    }
    // 2. Get pages for each site
    let allPages: any[] = [];
    for (const site of sites) {
      try {
        const pagesResponse = await client.get(`/v2/sites/${site.id}/pages`);
        const pages: any[] = pagesResponse.data?.pages || [];
        const siteInfoResponse = await client.get(`/v2/sites/${site.id}`);
        const siteInfo: any = siteInfoResponse.data;
        const enhancedPages: any[] = pages.map((page: any) => ({
          ...page,
          siteName: site.displayName || site.shortName,
          siteId: site.id,
          url: constructPublishedUrl(siteInfo, page),
          previewUrl: constructPreviewUrl(site.id, page.id),
        }));
        allPages = [...allPages, ...enhancedPages];
      } catch (error: any) {
        // Continue to next site
      }
    }
    res.status(200).json({ pages: allPages });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch pages', error: error.message });
  }
} 