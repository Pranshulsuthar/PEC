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
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS student_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS group_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS mentor_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS mentor_number INT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS group_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS group_name VARCHAR(160) NULL');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_profiles_group_id ON mentor_profiles (group_id)');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS coordinator_code VARCHAR(50) NULL');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_student_profiles_student_code ON student_profiles (student_code)');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_profiles_mentor_code ON mentor_profiles (mentor_code)');
    try {
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_profiles_mentor_number ON mentor_profiles (mentor_number)');
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_coordinator_profiles_coordinator_code ON coordinator_profiles (coordinator_code)');
    await pool.query('DROP TRIGGER IF EXISTS mentor_student_before_insert');
    await pool.query('DROP TRIGGER IF EXISTS mentor_mentees_before_insert');
    await pool.query('DROP TRIGGER IF EXISTS mentor_mentees_before_update');
    await pool.query("CREATE TRIGGER mentor_student_before_insert BEFORE INSERT ON mentor_student FOR EACH ROW BEGIN IF NEW.status = 'active' AND (SELECT COUNT(*) FROM mentor_student WHERE mentor_id = NEW.mentor_id AND status = 'active') >= 4 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor capacity reached. Maximum 4 mentees are allowed.'; END IF; END");
    await pool.query('DROP TRIGGER IF EXISTS mentor_student_before_update');
    await pool.query("CREATE TRIGGER mentor_student_before_update BEFORE UPDATE ON mentor_student FOR EACH ROW BEGIN IF NEW.status = 'active' AND (OLD.status <> 'active' OR OLD.mentor_id <> NEW.mentor_id) AND (SELECT COUNT(*) FROM mentor_student WHERE mentor_id = NEW.mentor_id AND status = 'active' AND id <> OLD.id) >= 4 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor capacity reached. Maximum 4 mentees are allowed.'; END IF; END");

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
