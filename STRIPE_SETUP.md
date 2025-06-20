# Stripe Integration Setup Guide

## 🚀 Setting Up Stripe for Premium Upgrades

I've successfully integrated Stripe for real payment processing instead of the fake payment simulation. Here's how to complete the setup:

## 1. Environment Variables

Create a `.env` file in the `api` directory with these variables:

```env
# Supabase Configuration (existing)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration (NEW)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Client Configuration (NEW)
CLIENT_URL=http://localhost:5173
```

## 2. Get Your Stripe Keys

### Test Secret Key:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Test mode** secret key (starts with `sk_test_`)
3. Add it to `STRIPE_SECRET_KEY` in your `.env` file

### Webhook Secret:
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **"Add endpoint"**
3. Set endpoint URL to: `https://your-domain.vercel.app/api/auth/stripe-webhook`
   - For local development: `https://your-ngrok-url.ngrok.io/api/auth/stripe-webhook`
4. Select event: `checkout.session.completed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to `STRIPE_WEBHOOK_SECRET` in your `.env` file

## 3. For Local Development (Optional)

If testing locally, you'll need ngrok to receive webhooks:

```bash
# Install ngrok if you haven't already
npm install -g ngrok

# Expose your local API
ngrok http 3000

# Use the ngrok URL for webhooks in Stripe Dashboard
```

## 4. Test Mode Features

The integration is set up for **test mode** which means:
- ✅ Real Stripe checkout flow
- ✅ Test credit card numbers work
- ✅ No actual money is charged
- ✅ Webhook processing works exactly like production

### Test Credit Cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0000 0000 3220`

Use any future expiry date, any 3-digit CVC, and any ZIP code.

## 5. How It Works

### User Flow:
1. User clicks "Upgrade to Premium"
2. Creates Stripe checkout session
3. Redirects to Stripe hosted checkout
4. User enters payment details
5. On success: Stripe webhook updates user to premium
6. User returns to dashboard with premium access

### Files Updated:
- ✅ `api/auth/upgrade-premium.ts` - Creates Stripe checkout sessions AND verifies payments
- ✅ `client/src/pages/Dashboard.tsx` - Updated for Stripe flow
- ✅ `client/src/components/Layout.tsx` - Updated for Stripe flow

**Note**: Consolidated into single endpoint to stay within Vercel Hobby plan's 12 function limit!

## 6. Deployment

### Vercel Environment Variables:
Add these to your Vercel dashboard under Settings > Environment Variables:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLIENT_URL=https://your-domain.vercel.app
```

### Update Webhook Endpoint:
When deployed, update your Stripe webhook endpoint URL to:
`https://your-domain.vercel.app/api/auth/stripe-webhook`

## 7. Going Live

When ready for production:
1. Switch to **Live mode** in Stripe Dashboard
2. Update `STRIPE_SECRET_KEY` with live key (`sk_live_...`)
3. Create new webhook endpoint for live mode
4. Update `STRIPE_WEBHOOK_SECRET` with live webhook secret

## 🎉 That's It!

Your premium upgrade system now uses real Stripe payment processing with test mode for safe development and testing! 