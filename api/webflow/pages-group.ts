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

function constructPublishedUrl(siteInfo: any, page: any): string | null {
  if (!siteInfo || !page) return null;
  const domain = siteInfo.domain || null;
  if (!domain) return null;
  return `https://${domain}${page.slug === 'index' ? '' : `/${page.slug}`}`;
}

function constructPreviewUrl(siteId: string, pageId: string): string {
  return `https://webflow.com/design/${siteId}/page/${pageId}`;
}

function normalizeToString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

async function getAllPages(req: VercelRequest, res: VercelResponse, webflowToken: string) {
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
      res.status(200).json({ pages: [], message: 'No sites found for this token' });
      return;
    }
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

async function getPageDetails(req: VercelRequest, res: VercelResponse, pageId: string, webflowToken: string) {
  try {
    const { siteId } = req.query;
    
    if (!siteId || typeof siteId !== 'string') {
      res.status(400).json({ message: 'Site ID is required as a query parameter' });
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

async function getPageDom(req: VercelRequest, res: VercelResponse, pageId: string, webflowToken: string) {
  try {
    // Get site ID from query parameters
    let { siteId } = req.query;
    
    if (!siteId || typeof siteId !== 'string') {
      try {
        // If siteId is not provided, try to get page details to find siteId
        const pageResponse = await axios.get(`https://api.webflow.com/v2/pages/${pageId}`, {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'Accept-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
        });
        siteId = pageResponse.data.site.id;
      } catch (error: any) {
        res.status(500).json({ message: 'Failed to determine site ID for page', error: error.message });
        return;
      }
    }

    // Fetch the page DOM
    const response = await axios.get(`https://api.webflow.com/v2/sites/${siteId}/pages/${pageId}/dom`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error fetching page DOM:', error.message);
    
    // Forward the appropriate status code from the Webflow API
    if (error.response?.status) {
      return res.status(error.response.status).json({ 
        message: 'Error fetching page DOM', 
        error: error.response?.data?.message || error.message 
      });
    }
    
    res.status(500).json({ message: 'Failed to fetch page DOM', error: error.message });
  }
}

async function getPageCustomCode(req: VercelRequest, res: VercelResponse, pageId: string, webflowToken: string) {
  try {
    // Get site ID from query parameters
    let { siteId } = req.query;
    
    if (!siteId || typeof siteId !== 'string') {
      try {
        // If siteId is not provided, try to get page details to find siteId
        const pageResponse = await axios.get(`https://api.webflow.com/v2/pages/${pageId}`, {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'Accept-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
        });
        siteId = pageResponse.data.site.id;
      } catch (error: any) {
        res.status(500).json({ message: 'Failed to determine site ID for page', error: error.message });
        return;
      }
    }

    // Fetch the page metadata which includes custom code
    const response = await axios.get(`https://api.webflow.com/v2/sites/${siteId}/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });

    const customCode = {
      headCode: response.data.customCodes?.head || '',
      footerCode: response.data.customCodes?.footer || '',
    };

    res.status(200).json(customCode);
  } catch (error: any) {
    console.error('Error fetching page custom code:', error.message);
    
    // Forward the appropriate status code from the Webflow API
    if (error.response?.status) {
      return res.status(error.response.status).json({ 
        message: 'Error fetching page custom code', 
        error: error.response?.data?.message || error.message 
      });
    }
    
    res.status(500).json({ message: 'Failed to fetch page custom code', error: error.message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[PAGES-GROUP] ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { url } = req;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const path = url.split('?')[0];
    const pathComponents = path.split('/').filter(Boolean);
    console.log(`[PAGES-GROUP] Path components:`, pathComponents);
    
    const webflowIndex = pathComponents.indexOf('webflow');
    if (webflowIndex === -1) {
      console.log(`[PAGES-GROUP] No 'webflow' found in path:`, path);
      return res.status(404).send('Not found: Invalid path structure');
    }
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      console.log(`[PAGES-GROUP] No webflow token found`);
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }

    // /api/webflow/pages/:pageId/dom
    if (path.includes('/pages/') && path.endsWith('/dom')) {
      const pagesIndex = pathComponents.indexOf('pages');
      if (pagesIndex !== -1 && pagesIndex < pathComponents.length - 2) {
        const pageId = pathComponents[pagesIndex + 1];
        console.log(`[PAGES-GROUP] Getting page DOM for:`, pageId);
        return getPageDom(req, res, pageId, webflowToken);
      }
    }

    // /api/webflow/pages/:pageId/custom-code
    if (path.includes('/pages/') && path.endsWith('/custom-code')) {
      const pagesIndex = pathComponents.indexOf('pages');
      if (pagesIndex !== -1 && pagesIndex < pathComponents.length - 2) {
        const pageId = pathComponents[pagesIndex + 1];
        console.log(`[PAGES-GROUP] Getting page custom code for:`, pageId);
        return getPageCustomCode(req, res, pageId, webflowToken);
      }
    }

    // /api/webflow/pages/:pageId (page details)
    const pagesIndex = pathComponents.indexOf('pages');
    if (pagesIndex !== -1 && pagesIndex < pathComponents.length - 1) {
      const pageId = pathComponents[pagesIndex + 1];
      // Make sure it's not an endpoint we've already handled
      if (!path.endsWith('/dom') && !path.endsWith('/custom-code')) {
        console.log(`[PAGES-GROUP] Getting page details for:`, pageId);
        return getPageDetails(req, res, pageId, webflowToken);
      }
    }
    
    // /api/webflow/pages
    if (path.endsWith('/pages')) {
      console.log(`[PAGES-GROUP] Getting all pages`);
      return getAllPages(req, res, webflowToken);
    }
    
    console.log(`[PAGES-GROUP] No matching route found for:`, path);
    res.status(404).send('Pages endpoint not found');
  } catch (error: any) {
    console.error(`[PAGES-GROUP] Error:`, error.message);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 