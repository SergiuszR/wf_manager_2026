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
    const { pageId } = req.query;
    const siteId = req.query.siteId;
    if (!pageId || typeof pageId !== 'string') {
      res.status(400).json({ message: 'Page ID is required' });
      return;
    }
    if (!siteId || typeof siteId !== 'string') {
      res.status(400).json({ message: 'Site ID is required as a query parameter' });
      return;
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(400).json({ message: 'No Webflow token available' });
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
    // Get site info
    const siteResponse = await client.get(`/v2/sites/${siteId}`);
    const site = siteResponse.data;
    if (!site) {
      res.status(404).json({ message: 'Site not found' });
      return;
    }
    // Get all pages for this site
    const pagesResponse = await client.get(`/v2/sites/${siteId}/pages`);
    const pages = pagesResponse.data?.pages || [];
    const page = pages.find((p: any) => p.id === pageId);
    if (!page) {
      res.status(404).json({ message: 'Page not found in this site' });
      return;
    }
    const enhancedPage = {
      ...page,
      siteName: site.displayName || site.shortName,
      siteId: site.id,
      url: constructPublishedUrl(site, page),
      previewUrl: constructPreviewUrl(siteId, pageId)
    };
    res.status(200).json(enhancedPage);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to get page details', error: error.message });
  }
} 