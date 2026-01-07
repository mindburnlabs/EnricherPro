const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database...');
    
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Successfully enabled "vector" extension.');
    
  } catch (err) {
    console.error('Error enabling extension:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
