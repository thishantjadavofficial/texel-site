const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bupqgbgzagwmxnvgcwrl.supabase.co';
const supabaseAnonKey = 'sb_publishable_3yU66GdVI0rGNKMVVYuaYg_rGIhq93r';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    // 1. Sign in anonymously
    console.log('Signing in anonymously...');
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          name: 'Guest Operator',
          region: 'Mumbai, India'
        }
      }
    });

    if (authError) {
      console.error('Auth failed:', authError.message);
      return;
    }

    const user = authData.user;
    console.log('Auth successful. User ID:', user.id);

    // 2. Fetch existing designs for this user
    const { data: existingDesigns, error: fetchError } = await supabase
      .from('designs')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Fetch designs failed:', fetchError.message);
    } else {
      console.log(`User has ${existingDesigns.length} designs in the database.`);
      console.log('Existing designs:', existingDesigns.map(d => ({ id: d.id, title: d.title })));
    }

    // 3. Try to insert new designs until we hit an error (up to 5 inserts)
    for (let i = 1; i <= 5; i++) {
      const designId = 'd_test_' + Date.now() + '_' + i;
      console.log(`\nAttempting to insert test design #${i}...`);
      const { data, error: insertError } = await supabase
        .from('designs')
        .insert({
          user_id: user.id,
          title: `Test Design #${i} (${Date.now()})`,
          tags: ['test'],
          preview_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119',
          master_url: 'https://encrypted-masters.texel.ai/escrow/test_' + designId,
          base_price: 100,
          max_discount_pct: 10,
          is_active: true
        })
        .select();

      if (insertError) {
        console.error(`INSERT FAILED: ${insertError.message}`);
        console.error('Details:', JSON.stringify(insertError, null, 2));
        break;
      } else {
        console.log(`Insert successful! Inserted design ID: ${data[0].id}`);
      }
    }

  } catch (err) {
    console.error('Execution error:', err);
  }
}

main();
