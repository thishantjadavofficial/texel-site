const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bupqgbgzagwmxnvgcwrl.supabase.co';
const supabaseAnonKey = 'sb_publishable_3yU66GdVI0rGNKMVVYuaYg_rGIhq93r';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    console.log('Querying all active designs...');
    const { data, error } = await supabase
      .from('designs')
      .select('*');

    if (error) {
      console.error('Failed to fetch designs:', error.message);
      return;
    }

    console.log(`Successfully fetched ${data.length} designs:`);
    data.forEach((design, index) => {
      console.log(`[${index + 1}] ID: ${design.id}`);
      console.log(`    Title: ${design.title}`);
      console.log(`    User ID: ${design.user_id}`);
      console.log(`    Created At: ${design.created_at}`);
      console.log(`    Preview URL: ${design.preview_url}`);
      console.log(`    Master URL: ${design.master_url}`);
      console.log('-----------------------------------');
    });

  } catch (err) {
    console.error('Execution error:', err);
  }
}

main();
