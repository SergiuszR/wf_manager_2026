# Vercel Deployment Guide

## Overview
This document provides instructions for deploying the Webflow 2026 app on Vercel. The app consists of a React frontend and a serverless API that communicates with Webflow's API.

## Important Update: Complete Rewrite of API Logic
To resolve dependency issues on Vercel, we've made a significant change to the application:

1. The API endpoint (/api/index.ts) now contains all the necessary authentication, user management, and basic Webflow API functionality directly inlined - **without** relying on imports from the server directory.

2. This bypasses the dependency issues with compiled TypeScript code and ensures all the necessary code is available in the API function.

## Implemented API Endpoints

The following Webflow API endpoints are now available:

### Authentication
- `/api/auth/authenticate` - Authenticate with Webflow token
- `/api/auth/profile` - Get user profile

### Webflow Data
- `/api/webflow/sites` - Get all Webflow sites
- `/api/webflow/pages` - Get all pages from all sites
- `/api/webflow/pages/:pageId` - Get details about a specific page (requires siteId query parameter)
- `/api/webflow/collections` - Get all collections from all sites
- `/api/webflow/collections/:collectionId` - Get collection details
- `/api/webflow/collections/:collectionId/items` - Get collection items

### Assets (New)
- `/api/webflow/sites/:siteId/assets` - Get all assets for a site
- `/api/webflow/assets/:assetId` - Get details about a specific asset
- `/api/webflow/sites/:siteId/assets` (POST) - Create a new asset (get upload URL)
- `/api/webflow/sites/:siteId/assets/csv` - Download assets as CSV
- `/api/webflow/assets/:assetId` (PATCH) - Update asset properties (e.g., alt text)

### Utility
- `/api/health` - Check API health
- `/api/debug` - Show environment configuration

## Deployment Steps

### 1. Environment Variables
Set the following environment variables in your Vercel project settings:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `VITE_SUPABASE_URL` - Same as SUPABASE_URL (for client-side)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key (for client-side authentication)
- `JWT_SECRET` - Secret key for JWT token generation (can be any secure random string)

### 2. Build Settings
The project is configured to build all components with the following build command (already set in vercel.json):
```
cd server && npm install && npm run build && cd ../client && npm install && npm run build && cd ../api && npm install
```

### 3. API Dependencies
All required API dependencies are included directly in the api/package.json file:
- express
- cors
- helmet
- jsonwebtoken
- axios
- form-data
- multer
- dotenv
- mongoose
- @supabase/supabase-js
- bcrypt
- webflow-api

### 4. Deployment Troubleshooting

If you encounter issues after deployment:

1. **Check Environment Variables**: Ensure all required environment variables are correctly set in the Vercel dashboard.

2. **Check API Health**: Visit `https://your-vercel-app.vercel.app/api/health` to verify the API is running.

3. **Debug Endpoint**: Visit `https://your-vercel-app.vercel.app/api/debug` to check if environment variables are loaded correctly.

4. **Logs**: Check the Vercel deployment logs for any errors about missing dependencies.

5. **Browser Dev Tools**: Check the browser's developer console for API request errors.

## Debugging Assets Issues

If you're still experiencing issues with the Assets component:

1. **Site Verification**: The API now verifies if the site exists before attempting to fetch assets. Check your Vercel logs for messages with the `[ASSETS]` prefix to see if site verification is successful.

2. **Beta API Limitations**: Webflow's Asset API is still in beta and has some limitations. Some sites might not support assets or may have restricted permissions.

3. **Token Permissions**: Ensure your Webflow API token has the necessary permissions for accessing assets. It may need the `assets.read` scope.

4. **Network Tab**: Use your browser's Network tab to investigate API calls:
   - Check if the request to `/api/webflow/sites/:siteId/assets` is actually being made
   - Look for any error responses and their content
   - Verify that the site ID being passed is correct

5. **Testing with Mockup Data**: If needed, you can uncomment the mockup data section in the API code to test if the frontend renders correctly with static data.

## Common Issues

### Missing Dependencies
If you see errors about missing modules, you may need to add the dependency to the api/package.json file. To redeploy with new dependencies:
1. Add the missing dependency to api/package.json
2. Commit and push your changes
3. Redeploy on Vercel

### API Requests 404 Error
If API requests return 404 errors, ensure that:
- The `vercel.json` file has the correct rewrites configuration
- The API route handlers are properly exported

### Authentication Issues
If you can log in but API requests fail with 401 or 403 errors:
- Check if the auth token is properly being passed to API requests
- Verify the Supabase environment variables are correctly set
- Ensure the JWT_SECRET environment variable is set

### Webflow API Token Issues
If Webflow API requests fail:
- Ensure your Webflow token is valid
- Check if the token is being passed correctly to the API routes

## Need More Help?
If you continue to experience issues, check the Vercel deployment logs and browser console for specific error messages that can help diagnose the problem. 