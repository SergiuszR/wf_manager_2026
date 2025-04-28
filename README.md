# Webflow Manager

A secure web application for managing Webflow projects using the official Webflow API.

## Features

- **Direct Webflow API Integration**: Uses the official [Webflow API](https://developers.webflow.com/data/reference/rest-introduction) for secure access to your sites
- **Secure Token Handling**: All Webflow API calls are made from the server-side, keeping your API tokens secure
- **Pages Viewer**: View all pages from your Webflow projects
- **Collections Explorer**: Explore CMS collections from your Webflow projects
- **Modern UI**: Clean, responsive interface built with React and styled-components

## Tech Stack

### Backend
- Node.js with Express
- MongoDB for token storage
- JWT for session management
- Official Webflow API

### Frontend
- React with TypeScript
- React Router for navigation
- Styled Components for styling
- Axios for API calls

## How It Works

This application provides a secure way to explore your Webflow sites:

1. You enter your Webflow API token (obtained from your Webflow account settings)
2. The token is stored securely in the database and never exposed to the browser
3. All API calls to Webflow are made through the backend server
4. The UI displays pages and collections from your Webflow sites

## Security Features

- Tokens are securely stored in the database
- All API calls to Webflow are made from the server, not from the browser
- JWT authentication to ensure only authorized users can access API endpoints
- CORS protection

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- MongoDB

### Installation

1. Clone the repository
```
git clone https://github.com/your-username/webflow-manager.git
cd webflow-manager
```

2. Install dependencies
```
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Configure environment variables
```
# Copy the example .env file in the server directory
cd ../server
cp .env.example .env

# Edit the .env file with your values
```

4. Start the development servers
```
# Start the server (from the server directory)
npm run dev

# Start the client (from the client directory)
cd ../client
npm run dev
```

5. Access the application
Open your browser and navigate to `http://localhost:3000`

## Getting a Webflow API Token

1. Log in to your Webflow account
2. Navigate to Account Settings
3. Select the "Integrations" tab
4. Under "API Access", generate a new token
5. Use this token to authenticate in the application

## Deployment on Vercel

To deploy this app on Vercel and ensure full functionality:

1. **Set Environment Variables**
   - Go to your Vercel project dashboard.
   - Navigate to Settings > Environment Variables.
   - Add the following variables (values from your Supabase project):
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

2. **Deploy**
   - After setting the variables, redeploy your project.

3. **Backend/API**
   - If your app relies on a backend (e.g., `/server`), ensure it is also deployed and accessible from your Vercel frontend.
   - Update any API URLs in your frontend to point to the deployed backend if needed.

4. **Troubleshooting**
   - If you see empty states or missing data, double-check your environment variables and backend/API accessibility.

## License

MIT 