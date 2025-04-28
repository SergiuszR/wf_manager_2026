# Vercel Deployment Guide

## Overview
This document provides instructions for deploying the Webflow 2026 app on Vercel. The app consists of a React frontend and a serverless API that communicates with Webflow's API.

## Deployment Steps

### 1. Environment Variables
Set the following environment variables in your Vercel project settings:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `VITE_SUPABASE_URL` - Same as SUPABASE_URL (for client-side)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key (for client-side authentication)
- `JWT_SECRET` - Secret key for JWT token generation (can be any secure random string)

### 2. Build Settings
The project is configured to build both the client and API components automatically with the following build command:
```
cd client && npm install && npm run build && cd ../api && npm install
```

This is already set in vercel.json.

### 3. API Dependencies
The following packages are required for the API to function correctly:
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

These are all included in the api/package.json file.

### 4. Deployment Troubleshooting

If you encounter issues after deployment:

1. **Check Environment Variables**: Ensure all required environment variables are correctly set in the Vercel dashboard.

2. **Check API Health**: Visit `https://your-vercel-app.vercel.app/api/health` to verify the API is running.

3. **Debug Endpoint**: Visit `https://your-vercel-app.vercel.app/api/debug` to check if environment variables are loaded correctly.

4. **Logs**: Check the Vercel deployment logs for any errors about missing dependencies.

5. **Browser Dev Tools**: Check the browser's developer console for API request errors.

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