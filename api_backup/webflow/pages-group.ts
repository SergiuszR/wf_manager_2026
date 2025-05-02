import { VercelRequest, VercelResponse } from '@vercel/node';
import pagesApiHandler from './pages-api';
import pagesHandler from './pages';
import pageIdHandler from './pages/[pageId]';
import customCodeHandler from './pages/[pageId]/custom-code';
import domHandler from './pages/[pageId]/dom';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS requests directly
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, method } = req;
  if (!url) return res.status(400).send('Missing URL');

  console.log(`Handling request: ${method} ${url}`);

  try {
    // Extract path components
    const path = url.split('?')[0]; // Remove query string
    const pathComponents = path.split('/').filter(Boolean);
    
    // Find where 'webflow' and 'pages' appear in the path
    const webflowIndex = pathComponents.indexOf('webflow');
    const pagesIndex = pathComponents.indexOf('pages');
    
    if (webflowIndex === -1 || pagesIndex === -1) {
      console.log('Invalid path structure:', path);
      return res.status(404).send('Not found: Invalid path structure');
    }
    
    // Extract relevant path components after 'pages'
    const pageComponents = pathComponents.slice(pagesIndex + 1);
    
    // /api/webflow/pages-api
    if (path.includes('/pages-api')) {
      console.log('Handling pages-api request');
      return pagesApiHandler(req, res);
    }
    
    // No components after pages means list all pages
    if (pageComponents.length === 0) {
      console.log('Handling pages list request');
      return pagesHandler(req, res);
    }
    
    // Extract pageId and further path components
    const pageId = pageComponents[0];
    const action = pageComponents[1];
    
    // /api/webflow/pages/:pageId/custom-code
    if (action === 'custom-code') {
      console.log(`Handling page ${pageId} custom-code request`);
      // Store pageId in query for handlers that expect it
      req.query.pageId = pageId;
      return customCodeHandler(req, res);
    }
    
    // /api/webflow/pages/:pageId/dom
    if (action === 'dom') {
      console.log(`Handling page ${pageId} dom request`);
      req.query.pageId = pageId;
      return domHandler(req, res);
    }
    
    // /api/webflow/pages/:pageId
    console.log(`Handling page ${pageId} details request`);
    req.query.pageId = pageId;
    return pageIdHandler(req, res);
  } catch (error) {
    console.error('Error handling pages request:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
} 