// Database initialization – create required tables if they do not exist
// This runs on server startup. It uses the schema shared with phpMyAdmin imports.
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function init() {
  try {
    console.log('📦 Initializing database schema...');
    const schemaPath = path.join(__dirname, '..', 'database', 'pec_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await pool.query(statement);
    }

    await pool.query(`
      ALTER TABLE student_profiles
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL
    `);
    await pool.query(`
      ALTER TABLE student_profiles
      ADD COLUMN IF NOT EXISTS year INT NULL
    `);
    await pool.query(`
      ALTER TABLE mentor_profiles
      ADD COLUMN IF NOT EXISTS specialization VARCHAR(200) NULL
    `);

    console.log('✅ Database initialization completed');
  } catch (err) {
    console.error('❌ Error during DB initialization:', err);
    process.exit(1);
  }
}

module.exports = { init };
