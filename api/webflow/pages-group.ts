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

async function getPageDom(req: VercelRequest, res: VercelResponse, pageId: string, webflowToken: string) {
  try {
    let { siteId } = req.query;
    siteId = normalizeToString(siteId);
    if (!siteId) {
      try {
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
    if (!siteId) {
      res.status(400).json({ message: 'Site ID could not be determined' });
      return;
    }
    const response = await axios.get(`https://api.webflow.com/v2/sites/${siteId}/pages/${pageId}/dom`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    res.status(200).json(response.data);
  } catch (error: any) {
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
    let { siteId } = req.query;
    siteId = normalizeToString(siteId);
    if (!siteId) {
      try {
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
    if (!siteId) {
      res.status(400).json({ message: 'Site ID could not be determined' });
      return;
    }
    const response = await axios.get(`https://api.webflow.com/v2/sites/${siteId}/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    const customCodeData = {
      headCode: response.data?.customCode?.head || '',
      footerCode: response.data?.customCode?.footer || '',
      cssCode: response.data?.customCode?.css || '',
      pageTitle: response.data?.title || '',
      pagePath: response.data?.path || '',
    };
    res.status(200).json(customCodeData);
  } catch (error: any) {
    if (error.response?.status) {
      return res.status(error.response.status).json({ 
        message: 'Error fetching page custom code', 
        error: error.response?.data?.message || error.message 
      });
    }
    res.status(500).json({ message: 'Failed to fetch page custom code', error: error.message });
  }
}

async function getPageDetails(req: VercelRequest, res: VercelResponse, pageId: string, webflowToken: string) {
  try {
    let { siteId } = req.query;
    siteId = normalizeToString(siteId);
    if (!siteId) {
      try {
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
    if (!siteId) {
      res.status(400).json({ message: 'Site ID could not be determined' });
      return;
    }
    const response = await axios.get(`https://api.webflow.com/v2/sites/${siteId}/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    const siteResponse = await axios.get(`https://api.webflow.com/v2/sites/${siteId}`, {
      headers: {
        'Authorization': `Bearer ${webflowToken}`,
        'Accept-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    });
    const siteInfo = siteResponse.data;
    const page = response.data;
    const enhancedPage = {
      ...page,
      siteName: siteInfo.displayName || siteInfo.shortName,
      siteId: siteId,
      url: constructPublishedUrl(siteInfo, page),
      previewUrl: constructPreviewUrl(siteId, pageId),
    };
    res.status(200).json(enhancedPage);
  } catch (error: any) {
    if (error.response?.status) {
      return res.status(error.response.status).json({ 
        message: 'Error fetching page details', 
        error: error.response?.data?.message || error.message 
      });
    }
    res.status(500).json({ message: 'Failed to fetch page details', error: error.message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { url, method } = req;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const path = url.split('?')[0];
    const pathComponents = path.split('/').filter(Boolean);
    const webflowIndex = pathComponents.indexOf('webflow');
    const pagesIndex = pathComponents.indexOf('pages');
    if (webflowIndex === -1 || pagesIndex === -1) {
      return res.status(404).send('Not found: Invalid path structure');
    }
    const pageComponents = pathComponents.slice(pagesIndex + 1);
    const webflowToken = getEffectiveWebflowToken(req);
    if (!webflowToken) {
      res.status(401).json({ message: 'No Webflow token found' });
      return;
    }
    // /api/webflow/pages
    if (pageComponents.length === 0) {
      return getAllPages(req, res, webflowToken);
    }
    let pageId: string | undefined = pageComponents[0];
    if (Array.isArray(pageId)) pageId = pageId[0];
    if (!pageId || typeof pageId !== 'string') {
      return res.status(400).json({ message: 'Invalid page ID' });
    }
    const action = pageComponents[1];
    if (action === 'custom-code') {
      return getPageCustomCode(req, res, pageId, webflowToken);
    }
    if (action === 'dom') {
      return getPageDom(req, res, pageId, webflowToken);
    }
    return getPageDetails(req, res, pageId, webflowToken);
  } catch (error: any) {
    res.status(500).send(`Server error: ${error.message}`);
  }
} 