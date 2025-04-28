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

### 2. Build Settings
The project is configured to build both the client and API components automatically.

### 3. Deployment Troubleshooting

If you encounter issues after deployment:

1. **Check Environment Variables**: Ensure all required environment variables are correctly set in the Vercel dashboard.

2. **Check API Health**: Visit `https://your-vercel-app.vercel.app/api/health` to verify the API is running.

3. **Debug Endpoint**: Visit `https://your-vercel-app.vercel.app/api/debug` to check if environment variables are loaded correctly.

4. **Logs**: Check the Vercel deployment logs for any errors.

5. **Browser Dev Tools**: Check the browser's developer console for API request errors.

## Common Issues

### API Requests 404 Error
If API requests return 404 errors, ensure that:
- The `vercel.json` file has the correct rewrites configuration
- The API route handlers are properly exported

### Authentication Issues
If you can log in but API requests fail with 401 or 403 errors:
- Check if the auth token is properly being passed to API requests
- Verify the Supabase environment variables are correctly set

### Webflow API Token Issues
If Webflow API requests fail:
- Ensure your Webflow token is valid
- Check if the token is being passed correctly to the API routes

## Need More Help?
If you continue to experience issues, check the Vercel deployment logs and browser console for specific error messages that can help diagnose the problem. 