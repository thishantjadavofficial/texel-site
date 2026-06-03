
const url = 'https://bupqgbgzagwmxnvgcwrl.supabase.co/rest/v1/';
const apiKey = 'sb_publishable_3yU66GdVI0rGNKMVVYuaYg_rGIhq93r';

async function main() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!res.ok) {
      console.error('Fetch failed:', res.status, res.statusText);
      const text = await res.text();
      console.error(text);
      return;
    }
    
    const data = await res.json();
    console.log('--- SUPABASE DATABASE OBJECTS ---');
    console.log('Tables/Paths found:', Object.keys(data.paths));
    
    // Look for RPC paths
    const rpcs = Object.keys(data.paths).filter(path => path.startsWith('/rpc/'));
    console.log('RPCs (functions) found:', rpcs);
    
    // Print info about designs table schema
    if (data.definitions && data.definitions.designs) {
      console.log('\n--- DESIGNS TABLE COLUMNS ---');
      console.log(JSON.stringify(data.definitions.designs.properties, null, 2));
    }
  } catch (err) {
    console.error('Error running inspection:', err);
  }
}

main();
