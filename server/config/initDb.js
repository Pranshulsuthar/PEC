const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function init() {
  try {
    console.log('Initializing database schema...');
    await pool.ensureDatabase();
    await pool.testConnection();

    const schemaPath = path.join(__dirname, '..', 'database', 'pec_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement && !statement.startsWith('--'));

    for (const statement of statements) {
      await pool.query(statement);
    }

    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS year INT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(200) NULL');

    console.log('Database connection and schema ready');
  } catch (err) {
    console.error('Database startup failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('Start MySQL and verify DB_HOST/DB_PORT in .env');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Verify DB_USER and DB_PASSWORD in .env');
    }
    throw err;
  }
}

module.exports = { init };
