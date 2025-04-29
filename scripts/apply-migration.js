const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get the Supabase URL and key from environment variables or hard-code for this script
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL and key are required. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250424132124_create-activity-logs-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration for activity_logs table...');
    
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { query: migrationSQL });
    
    if (error) {
      console.error('Error applying migration:', error);
      process.exit(1);
    }
    
    console.log('Migration applied successfully! activity_logs table is now available.');
  } catch (err) {
    console.error('Error reading migration file or applying migration:', err);
    process.exit(1);
  }
}

applyMigration(); 