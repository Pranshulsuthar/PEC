const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper: create JWT payload
function generateToken(user) {
  const payload = {
    user_id: user.id || user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'change_this_to_a_secure_secret', { expiresIn: '12h' });
}

/**
 * Register a new user and role‑specific record.
 * Expected body: { name, email, password, role, ...roleData }
 */
exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
    if (!['student', 'mentor', 'coordinator'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
  if (role === 'coordinator' && req.get('x-pec-coordinator-invite') !== process.env.COORDINATOR_REGISTRATION_TOKEN) return res.status(403).json({ success: false, message: 'Coordinator registration requires an administrator invite' });
  if (String(password).length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  if (!String(name).trim() || String(name).trim().length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid name and email address' });
  const collegeId = typeof req.body.college_id === 'string' ? req.body.college_id.trim() : '';
  const branch = req.body.branch;
  const year = Number(req.body.year);
  const section = typeof req.body.section === 'string' ? req.body.section.trim() : '';
  if (!collegeId || collegeId.length > 80) return res.status(400).json({ success: false, message: 'College ID is required (maximum 80 characters)' });
  const enrollmentNo = role === 'student' ? String(req.body.enrollment_no || '').trim() : collegeId;
  if (role === 'student' && (!enrollmentNo || enrollmentNo.length > 80)) return res.status(400).json({ success: false, message: 'Enrollment number is required (maximum 80 characters)' });
  if (!['IT', 'CS', 'AI', 'DS'].includes(branch)) return res.status(400).json({ success: false, message: 'Select a valid branch' });
  if (!Number.isInteger(year) || year < 1 || year > 4) return res.status(400).json({ success: false, message: 'Select a valid year (1-4)' });
  if (!section || section.length > 50) return res.status(400).json({ success: false, message: 'Section is required (maximum 50 characters)' });
  if (role === 'student') {
    const socialFields = ['linkedin_profile', 'github_profile', 'leetcode_profile'];
    for (const field of socialFields) {
      const value = req.body[field];
      if (value && (typeof value !== 'string' || value.length > 500 || !/^https?:\/\//i.test(value))) return res.status(400).json({ success: false, message: 'Social profile links must be valid HTTP or HTTPS URLs' });
    }
  }
  let connection;
  let accountLock = false;
  try {
    connection = await pool.getConnection();
    const [[lock]] = await connection.query("SELECT GET_LOCK('pec_account_registration', 10) AS acquired");
    accountLock = Number(lock.acquired) === 1;
    if (!accountLock) throw Object.assign(new Error('Registration is busy. Please try again.'), { statusCode: 409 });
    await connection.beginTransaction();
    const [[duplicateCrossRoleCollegeId]] = await connection.query('SELECT user_id FROM student_profiles WHERE college_id = ? UNION ALL SELECT user_id FROM mentor_profiles WHERE college_id = ? UNION ALL SELECT user_id FROM coordinator_profiles WHERE college_id = ? LIMIT 1', [String(req.body.college_id).trim(), String(req.body.college_id).trim(), String(req.body.college_id).trim()]);
    if (duplicateCrossRoleCollegeId) throw Object.assign(new Error('College ID already exists'), { statusCode: 409 });
    if (role === 'student') {
      const [[duplicateEnrollment]] = await connection.query('SELECT user_id FROM student_profiles WHERE enrollment_no = ? FOR UPDATE', [enrollmentNo]);
      if (duplicateEnrollment) throw Object.assign(new Error('Enrollment number already exists'), { statusCode: 409 });
    }
    const [[duplicateUser]] = await connection.query('SELECT id FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    const [[duplicateProfileEmail]] = await connection.query('SELECT user_id FROM student_profiles WHERE email = ? UNION ALL SELECT user_id FROM mentor_profiles WHERE email = ? UNION ALL SELECT user_id FROM coordinator_profiles WHERE email = ? LIMIT 1', [String(email).trim().toLowerCase(), String(email).trim().toLowerCase(), String(email).trim().toLowerCase()]);
    if (duplicateUser || duplicateProfileEmail) throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
    await connection.query("INSERT INTO account_id_counters (prefix, next_value) VALUES ('PEC', 100) ON DUPLICATE KEY UPDATE next_value = GREATEST(next_value, 100)");
    const [[counter]] = await connection.query("SELECT next_value FROM account_id_counters WHERE prefix = 'PEC' FOR UPDATE");
    const pecId = 'PEC_' + Number(counter.next_value);
    await connection.query("UPDATE account_id_counters SET next_value = next_value + 1 WHERE prefix = 'PEC'");
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await connection.query('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)', [String(name).trim(), String(email).trim().toLowerCase(), hashed, role]);
    const user_id = result.insertId;
    if (role === 'student') {
      const { college_id, branch, year, section, linkedin_profile, github_profile, leetcode_profile } = req.body;
      await connection.query('INSERT INTO student_profiles (user_id, student_code, email, college_id, enrollment_no, roll_number, branch, year, section, linkedin_profile, github_profile, leetcode_profile) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [user_id, pecId, String(email).trim().toLowerCase(), String(college_id).trim(), enrollmentNo, enrollmentNo, branch, Number(year), String(section).trim(), linkedin_profile || null, github_profile || null, leetcode_profile || null]);
    } else if (role === 'mentor') {
      const { college_id, branch, year, section } = req.body;
      const [[mentorNumberRow]] = await connection.query('SELECT COALESCE(MAX(mentor_number), 0) + 1 AS mentor_number FROM mentor_profiles');
      await connection.query('INSERT INTO mentor_profiles (user_id, mentor_code, email, mentor_number, college_id, branch, year, section, designation, department) VALUES (?,?,?,?,?,?,?,?,?,?)', [user_id, pecId, String(email).trim().toLowerCase(), mentorNumberRow.mentor_number, String(college_id).trim(), branch, Number(year), String(section).trim(), 'Mentor', branch]);
    }
    await connection.commit();
    const token = generateToken({ id: user_id, name: String(name).trim(), email: String(email).trim().toLowerCase(), role });
    return res.status(201).json({ success: true, message: 'Account registered successfully', pec_id: pecId, token, user: { user_id, name: String(name).trim(), email: String(email).trim().toLowerCase(), role } });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('Registration rollback failed:', rollbackError); }
    }
    console.error('Register error:', err);
    return res.status(err.statusCode || (err.code === 'ER_DUP_ENTRY' ? 409 : 500)).json({ success: false, message: err.statusCode ? err.message : (err.code === 'ER_DUP_ENTRY' ? 'ID or email already exists' : 'Server error') });
  } finally {
    if (accountLock && connection) {
      try { await connection.query("SELECT RELEASE_LOCK('pec_account_registration')"); } catch (error) { console.error('Account lock release error:', error); }
    }
    if (connection) connection.release();
  }
};

/**
 * Login endpoint – verifies email/password and role.
 */
exports.login = async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Missing credentials' });
  }
  if (!['student', 'mentor', 'coordinator'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [String(email).trim().toLowerCase()]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = rows[0];
    if (user.role !== role) return res.status(403).json({ success: false, message: 'Role mismatch' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (user.role !== role) {
      return res.status(403).json({ success: false, message: 'Role mismatch' });
    }
    await pool.query('UPDATE users SET last_login = NOW(), is_active = 1 WHERE id = ?', [user.id]);
    const token = generateToken(user);
    const { id: user_id, name, email: userEmail, role: userRole } = user;
    return res.json({ success: true, message: 'Login successful', token, user: { user_id, name, email: userEmail, role: userRole } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  // req.user populated by auth middleware
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthenticated' });
  return res.json({ success: true, user: req.user });
};
