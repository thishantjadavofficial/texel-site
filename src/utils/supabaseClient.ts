import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bupqgbgzagwmxnvgcwrl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_3yU66GdVI0rGNKMVVYuaYg_rGIhq93r';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
