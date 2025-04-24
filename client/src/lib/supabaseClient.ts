import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xfymxjfsmlhjqyxhdabm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmeW14amZzbWxoanF5eGhkYWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MDA1ODIsImV4cCI6MjA2MTA3NjU4Mn0.CpbxP5ncA6TvtbUE9zMu3rRTTktoMvknLAG3Ckhf3io';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 