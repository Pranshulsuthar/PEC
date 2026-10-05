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

    await pool.query(`CREATE TABLE IF NOT EXISTS news_reads (
      user_id INT NOT NULL,
      news_id INT NOT NULL,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, news_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
      INDEX idx_news_reads_news (news_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS resources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      resource_type ENUM('document','video','link','tutorial','pdf','github') NOT NULL,
      resource_url VARCHAR(500) NOT NULL,
      category VARCHAR(100) NULL,
      uploaded_by INT NOT NULL,
      status ENUM('draft','published','archived') DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_res_uploader (uploaded_by),
      INDEX idx_res_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS account_id_counters (
      prefix VARCHAR(20) NOT NULL PRIMARY KEY,
      next_value BIGINT UNSIGNED NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS user_profiles_migration_marker (
      migration_key VARCHAR(80) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS student_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS college_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS enrollment_no VARCHAR(80) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS year INT NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS section VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS linkedin_profile VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS github_profile VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS leetcode_profile VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS skills TEXT NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS semester INT NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS college VARCHAR(150) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS github_url VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await pool.query('UPDATE student_profiles SET enrollment_no = COALESCE(roll_number, college_id) WHERE enrollment_no IS NULL');
    await pool.query('UPDATE student_profiles SET college_id = COALESCE(college_id, enrollment_no) WHERE college_id IS NULL');
    await pool.query('UPDATE student_profiles SET roll_number = COALESCE(roll_number, enrollment_no) WHERE roll_number IS NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS mentor_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS college_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS mentor_number INT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS group_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS year INT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS section VARCHAR(50) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(200) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS experience TEXT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS coordinator_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS college_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS year INT NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS section VARCHAR(50) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS student_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS college_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS enrollment_no VARCHAR(80) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS year INT NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS section VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS linkedin_profile VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS github_profile VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS leetcode_profile VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS skills TEXT NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS semester INT NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS college VARCHAR(150) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS github_url VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS mentor_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS college_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS year INT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS section VARCHAR(50) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(200) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS experience TEXT NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500) NULL');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS coordinator_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS college_id VARCHAR(80) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS year INT NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS section VARCHAR(50) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await pool.query('UPDATE student_profiles sp JOIN users u ON u.id = sp.user_id SET sp.email = u.email WHERE sp.email IS NULL');
    await pool.query('UPDATE student_profiles SET enrollment_no = COALESCE(enrollment_no, roll_number, college_id) WHERE enrollment_no IS NULL');
    await pool.query('UPDATE student_profiles SET roll_number = COALESCE(roll_number, enrollment_no) WHERE roll_number IS NULL');
    await pool.query('UPDATE student_profiles SET college_id = COALESCE(college_id, enrollment_no) WHERE college_id IS NULL');
    await pool.query('UPDATE mentor_profiles mp JOIN users u ON u.id = mp.user_id SET mp.email = u.email WHERE mp.email IS NULL');
    await pool.query('UPDATE coordinator_profiles cp JOIN users u ON u.id = cp.user_id SET cp.email = u.email WHERE cp.email IS NULL');
    await pool.query('UPDATE student_profiles SET enrollment_no = college_id WHERE enrollment_no IS NULL AND college_id IS NOT NULL');
    await pool.query('UPDATE student_profiles SET college_id = enrollment_no WHERE college_id IS NULL AND enrollment_no IS NOT NULL');
    await pool.query('UPDATE student_profiles SET roll_number = enrollment_no WHERE roll_number IS NULL AND enrollment_no IS NOT NULL');
    const profileUniqueIndexes = [
      ['uq_student_profiles_college_id', 'student_profiles', 'college_id'],
      ['uq_mentor_profiles_college_id', 'mentor_profiles', 'college_id'],
      ['uq_coordinator_profiles_college_id', 'coordinator_profiles', 'college_id'],
      ['uq_student_profiles_email', 'student_profiles', 'email'],
      ['uq_mentor_profiles_email', 'mentor_profiles', 'email'],
      ['uq_coordinator_profiles_email', 'coordinator_profiles', 'email']
    ];
    for (const [indexName, tableName, columnName] of profileUniqueIndexes) {
      try { await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnName})`); }
      catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; console.error('Duplicate legacy values found for ' + tableName + '.' + columnName + '; existing records were preserved.'); }
    }
    try { await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_profiles_group_id ON mentor_profiles (group_id)'); }
    catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; console.error('Duplicate legacy mentor group IDs remain; group uniqueness index was not added.'); }
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS coordinator_code VARCHAR(50) NULL');
    await pool.query('ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL');
    try { await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_profiles_mentor_number ON mentor_profiles (mentor_number)'); }
    catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; console.error('Duplicate legacy mentor numbers remain; preserving records and skipping mentor-number index.'); }
    await pool.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE');
    const [counterTables] = await pool.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_id_counters'");
    if (!counterTables.length) await pool.query('CREATE TABLE account_id_counters (prefix VARCHAR(20) NOT NULL PRIMARY KEY, next_value BIGINT UNSIGNED NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    const pecMigrationLock = await pool.getConnection();
    try {
      const [[pecLock]] = await pecMigrationLock.query("SELECT GET_LOCK('pec_ids_migration_v1', 30) AS acquired");
      if (Number(pecLock.acquired) !== 1) throw new Error('Could not obtain PEC ID migration lock');
    } finally { pecMigrationLock.release(); }
    const [markerTables] = await pool.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles_migration_marker'");
    if (!markerTables.length) await pool.query('CREATE TABLE user_profiles_migration_marker (migration_key VARCHAR(80) NOT NULL PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    await pool.query('UPDATE student_profiles SET enrollment_no = college_id WHERE enrollment_no IS NULL AND college_id IS NOT NULL');
    await pool.query('UPDATE student_profiles SET college_id = enrollment_no WHERE college_id IS NULL AND enrollment_no IS NOT NULL');
    const [[studentEnrollmentDuplicates]] = await pool.query('SELECT COUNT(*) AS count FROM (SELECT college_id FROM student_profiles WHERE college_id IS NOT NULL GROUP BY college_id HAVING COUNT(*) > 1) duplicates_found');
    if (Number(studentEnrollmentDuplicates.count) === 0) {
      try { await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_student_profiles_college_id ON student_profiles (college_id)'); }
      catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; console.error('Duplicate college IDs remain in existing records; preserving data and not enforcing the unique index.'); }
    } else {
      console.error('Existing duplicate college IDs found; records are preserved and college ID uniqueness is not enforced until duplicates are resolved.');
    }
    const [[migrationApplied]] = await pool.query("SELECT migration_key FROM user_profiles_migration_marker WHERE migration_key = 'generated-pec-ids-v1'");
    if (!migrationApplied) {
      const counterConnection = await pool.getConnection();
      let migrationLock = false;
      try {
        const [[lock]] = await counterConnection.query("SELECT GET_LOCK('pec_ids_migration_v1', 30) AS acquired");
        migrationLock = Number(lock.acquired) === 1;
        if (!migrationLock) throw new Error('Could not obtain PEC ID migration lock');
        const [[alreadyApplied]] = await counterConnection.query("SELECT migration_key FROM user_profiles_migration_marker WHERE migration_key = 'generated-pec-ids-v1'");
        if (!alreadyApplied) {
          await counterConnection.beginTransaction();
          const [[maxExisting]] = await counterConnection.query(`SELECT MAX(CAST(SUBSTRING_INDEX(pec_id, '_', -1) AS UNSIGNED)) AS max_id FROM (SELECT student_code AS pec_id FROM student_profiles UNION ALL SELECT mentor_code FROM mentor_profiles UNION ALL SELECT coordinator_code FROM coordinator_profiles) existing_ids WHERE pec_id REGEXP '^PEC_[0-9]+$'`);
          let nextValue = Math.max(100, Number(maxExisting.max_id || 99) + 1);
          const [coordinatorRows] = await counterConnection.query('SELECT user_id, coordinator_code FROM coordinator_profiles ORDER BY user_id');
          const [studentRows] = await counterConnection.query('SELECT user_id, student_code FROM student_profiles ORDER BY user_id');
          const [mentorRows] = await counterConnection.query('SELECT user_id, mentor_code FROM mentor_profiles ORDER BY user_id');
          const seenIds = new Set();
          const assignments = [];
          function queueLegacyIds(rows, field, table) {
            rows.forEach(function (row) {
              const current = row[field];
              if (!current || !/^PEC_[0-9]+$/.test(current) || seenIds.has(current)) assignments.push({ table: table, userId: row.user_id });
              else seenIds.add(current);
            });
          }
          queueLegacyIds(coordinatorRows, 'coordinator_code', 'coordinator_profiles');
          queueLegacyIds(studentRows, 'student_code', 'student_profiles');
          queueLegacyIds(mentorRows, 'mentor_code', 'mentor_profiles');
          for (const item of assignments) {
            const pecId = 'PEC_' + nextValue++;
            if (item.table === 'coordinator_profiles') await counterConnection.query('UPDATE coordinator_profiles SET coordinator_code = ?, employee_id = ? WHERE user_id = ?', [pecId, pecId, item.userId]);
            else if (item.table === 'student_profiles') await counterConnection.query('UPDATE student_profiles SET student_code = ? WHERE user_id = ?', [pecId, item.userId]);
            else await counterConnection.query('UPDATE mentor_profiles SET mentor_code = ? WHERE user_id = ?', [pecId, item.userId]);
          }
          await counterConnection.query("INSERT INTO account_id_counters (prefix, next_value) VALUES ('PEC', ?) ON DUPLICATE KEY UPDATE next_value = GREATEST(next_value, VALUES(next_value))", [nextValue]);
          await counterConnection.query("INSERT INTO user_profiles_migration_marker (migration_key) VALUES ('generated-pec-ids-v1')");
          await counterConnection.commit();
        }
      } catch (error) {
        try { await counterConnection.rollback(); } catch (rollbackError) { console.error('PEC ID migration rollback failed:', rollbackError); }
        throw error;
      } finally {
        if (migrationLock) { try { await counterConnection.query("SELECT RELEASE_LOCK('pec_ids_migration_v1')"); } catch (error) { console.error('PEC ID migration lock release failed:', error); } }
        counterConnection.release();
      }
    }
    await pool.query('UPDATE student_profiles SET email = (SELECT email FROM users WHERE users.id = student_profiles.user_id) WHERE email IS NULL');
    await pool.query('UPDATE mentor_profiles SET email = (SELECT email FROM users WHERE users.id = mentor_profiles.user_id) WHERE email IS NULL');
    await pool.query('UPDATE coordinator_profiles SET email = (SELECT email FROM users WHERE users.id = coordinator_profiles.user_id) WHERE email IS NULL');
    await pool.query('DROP TRIGGER IF EXISTS mentor_student_before_insert');
    await pool.query('DROP TRIGGER IF EXISTS mentor_mentees_before_insert');
    await pool.query('DROP TRIGGER IF EXISTS mentor_mentees_before_update');
    await pool.query("CREATE TRIGGER mentor_student_before_insert BEFORE INSERT ON mentor_student FOR EACH ROW BEGIN IF NEW.status = 'active' AND (SELECT COUNT(*) FROM mentor_student WHERE mentor_id = NEW.mentor_id AND status = 'active') >= 7 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor capacity reached. Maximum 7 mentees are allowed.'; END IF; END");
    await pool.query('DROP TRIGGER IF EXISTS mentor_student_before_update');
    await pool.query("CREATE TRIGGER mentor_student_before_update BEFORE UPDATE ON mentor_student FOR EACH ROW BEGIN IF NEW.status = 'active' AND (OLD.status <> 'active' OR OLD.mentor_id <> NEW.mentor_id) AND (SELECT COUNT(*) FROM mentor_student WHERE mentor_id = NEW.mentor_id AND status = 'active' AND id <> OLD.id) >= 7 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor capacity reached. Maximum 7 mentees are allowed.'; END IF; END");

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
