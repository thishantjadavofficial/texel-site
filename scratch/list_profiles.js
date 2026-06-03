const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bupqgbgzagwmxnvgcwrl.supabase.co';
const supabaseAnonKey = 'sb_publishable_3yU66GdVI0rGNKMVVYuaYg_rGIhq93r';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    console.log('Querying all profiles...');
    const { data, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) {
      console.error('Failed to fetch profiles:', error.message);
      return;
    }

    console.log(`Successfully fetched ${data.length} profiles:`);
    data.forEach((profile, index) => {
      console.log(`[${index + 1}] ID: ${profile.id}`);
      console.log(`    Email: ${profile.email}`);
      console.log(`    Name: ${profile.name}`);
      console.log(`    Region: ${profile.region}`);
      console.log(`    Role: ${profile.role}`);
      console.log(`    Has Accepted T&C: ${profile.has_accepted_tc}`);
      console.log('-----------------------------------');
    });

  } catch (err) {
    console.error('Execution error:', err);
  }
}

main();
