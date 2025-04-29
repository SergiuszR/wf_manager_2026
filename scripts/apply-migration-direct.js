const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get the Supabase URL and service role key from environment variables
// IMPORTANT: This requires the SERVICE_ROLE key, not the anon key, to create tables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL and service role key are required.');
  console.error('Set REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('The service role key can be found in your Supabase project settings.');
  process.exit(1);
}

// Create Supabase client with service role key for admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    // Create activity_logs table
    console.log('Creating activity_logs table...');
    const { error: createTableError } = await supabase.from('activity_logs').select('id').limit(1);
    
    if (createTableError && createTableError.code === '42P01') { // Table doesn't exist
      console.log('Table does not exist, creating it...');

      // Execute raw SQL to create the table
      const { error } = await supabase.rpc('create_activity_logs_table');
      
      if (error) {
        console.error('Error creating table:', error);
        console.log('You may need to manually create the table using the Supabase dashboard.');
        console.log('Go to SQL Editor and run the contents of supabase/migrations/20250424132124_create-activity-logs-table.sql');
        process.exit(1);
      }
      
      console.log('Table created successfully!');
    } else if (createTableError) {
      console.error('Unexpected error checking table:', createTableError);
      process.exit(1);
    } else {
      console.log('Table already exists!');
    }
  } catch (err) {
    console.error('Error in migration process:', err);
    process.exit(1);
  }
}

// Function to create the RPC function used to create the table
async function createRpcFunction() {
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250424132124_create-activity-logs-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Creating RPC function to execute SQL...');
    
    // Create a temporary RPC function to execute our SQL
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION create_activity_logs_table()
      RETURNS void AS $$
      BEGIN
        ${migrationSQL}
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    const { error } = await supabase.rpc('execute_sql', { sql: createFunctionSQL });
    
    if (error) {
      // If the execute_sql RPC doesn't exist, suggest manual creation
      console.error('Error creating RPC function:', error);
      console.log('You may need to manually create the table using the Supabase dashboard.');
      console.log('Go to SQL Editor and run the contents of supabase/migrations/20250424132124_create-activity-logs-table.sql');
      process.exit(1);
    }
    
    console.log('RPC function created successfully!');
  } catch (err) {
    console.error('Error creating RPC function:', err);
    process.exit(1);
  }
}

// First create the RPC function, then apply the migration
createRpcFunction()
  .then(() => applyMigration())
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  }); 