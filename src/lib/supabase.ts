import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yokxmlatktvxqymxtktn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlva3htbGF0a3R2eHF5bXh0a3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODgwNjksImV4cCI6MjA4MTE2NDA2OX0.ubCshUIfy05uo_U8LzKo4hgxbiRDcybXjo72bUi3Qag';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;