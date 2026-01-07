const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database...');
    
    // Drop the evidence table that is causing conflicts
    // Using CASCADE to remove dependent foreign keys/constraints
    await client.query('DROP TABLE IF EXISTS "evidence" CASCADE;');
    console.log('Dropped "evidence" table.');
    
    // Also likely need to drop these if they exist in a partial state to be clean
    await client.query('DROP TABLE IF EXISTS "audit_log" CASCADE;');
    await client.query('DROP TABLE IF EXISTS "model_usage" CASCADE;');
    
    console.log('Cleanup complete.');
    
  } catch (err) {
    console.error('Error cleaning DB:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
