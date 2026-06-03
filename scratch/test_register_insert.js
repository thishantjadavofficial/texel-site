const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bupqgbgzagwmxnvgcwrl.supabase.co';
const supabaseAnonKey = 'sb_publishable_3yU66GdVI0rGNKMVVYuaYg_rGIhq93r';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const randomId = Math.random().toString(36).substring(2, 10);
  const email = `testuser_${randomId}@texel.ai`;
  const password = 'TestPassword123!';

  try {
    console.log(`Attempting to sign up test user: ${email}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: `Test User ${randomId}`,
          region: 'Mumbai, India'
        }
      }
    });

    if (signUpError) {
      console.error('Sign up failed:', signUpError.message);
      return;
    }

    console.log('Sign up call successful. Checking if session was established...');
    let session = signUpData.session;
    let user = signUpData.user;

    if (!session) {
      console.log('Session not established directly. Attempting to sign in with password...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) {
        console.error('Sign in failed (email confirmation probably required):', signInError.message);
        return;
      }
      session = signInData.session;
      user = signInData.user;
    }

    console.log('Authentication successful. User ID:', user.id);

    // Ensure the profile row exists. The trigger 'on_auth_user_created' should have run,
    // but let's select it first to verify.
    const { data: profileCheck, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to query profile:', profileError.message);
    } else {
      console.log('Profile found in database:', profileCheck);
    }

    // Try to insert 3 designs
    for (let i = 1; i <= 3; i++) {
      console.log(`\nInserting design #${i} for user ${user.id}...`);
      const { data: insertData, error: insertError } = await supabase
        .from('designs')
        .insert({
          user_id: user.id,
          title: `Test Pattern #${i}`,
          tags: ['pattern', 'test'],
          preview_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119',
          master_url: 'https://encrypted-masters.texel.ai/escrow/test_pattern_' + i,
          base_price: 150,
          max_discount_pct: 15,
          is_active: true
        })
        .select();

      if (insertError) {
        console.error(`INSERT #${i} FAILED:`, insertError.message);
        console.error('Full Error details:', JSON.stringify(insertError, null, 2));
      } else {
        console.log(`INSERT #${i} SUCCESSFUL! Design ID: ${insertData[0].id}`);
      }
    }

  } catch (err) {
    console.error('Uncaught script error:', err);
  }
}

main();
