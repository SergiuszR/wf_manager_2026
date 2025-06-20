import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    return handleCreateCheckout(req, res);
  } else if (req.method === 'GET') {
    return handleVerifyPayment(req, res);
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
}

async function handleCreateCheckout(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Verify the user token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Check if user is already premium
  if (user.user_metadata?.premium === true) {
    res.status(400).json({ error: 'User is already premium' });
    return;
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Create or get Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          user_id: user.id
        }
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Premium Upgrade',
              description: 'Unlock all premium features including CMS management, page publishing, and priority support',
            },
            unit_amount: 1900, // $19.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?session_id={CHECKOUT_SESSION_ID}&upgrade=success`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?upgrade=cancelled`,
      metadata: {
        user_id: user.id,
        type: 'premium_upgrade'
      }
    });

    res.json({ 
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function handleVerifyPayment(req: VercelRequest, res: VercelResponse) {
  const { session_id } = req.query;
  
  if (!session_id || typeof session_id !== 'string') {
    res.status(400).json({ error: 'Missing session_id parameter' });
    return;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid' && session.metadata?.user_id) {
      // Use admin client to update user metadata
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        session.metadata.user_id,
        {
          user_metadata: {
            premium: true,
            premium_since: new Date().toISOString(),
            stripe_customer_id: session.customer,
            stripe_session_id: session.id,
            subscription_id: `stripe_${session.id}`
          }
        }
      );

      if (error) {
        console.error('Error updating user premium status:', error);
        res.status(500).json({ error: 'Failed to upgrade account' });
        return;
      }

      console.log(`Successfully upgraded user ${session.metadata.user_id} to premium`);

      res.json({ 
        success: true, 
        message: 'Successfully upgraded to premium!',
        payment_status: session.payment_status,
        user: {
          id: data.user.id,
          email: data.user.email,
          premium: true
        }
      });
    } else {
      res.json({
        success: false,
        payment_status: session.payment_status,
        message: session.payment_status === 'unpaid' ? 'Payment not completed yet' : 'Payment failed'
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 