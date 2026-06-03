const fs = require('fs');

const url = 'https://bupqgbgzagwmxnvgcwrl.supabase.co/rest/v1/';
const apiKey = 'sb_publishable_3yU66GdVI0rGNKMVVYuaYg_rGIhq93r';

async function main() {
  try {
    console.log('Fetching OpenAPI schema from Supabase REST endpoint...');
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
    console.log('Fetch successful. Saving schema to scratch/schema.json...');
    fs.writeFileSync('scratch/schema.json', JSON.stringify(data, null, 2));
    console.log('Saved! Table definitions:');
    if (data.definitions) {
      Object.keys(data.definitions).forEach(def => {
        console.log(`- ${def}`);
      });
    }
  } catch (err) {
    console.error('Execution error:', err);
  }
}

main();
