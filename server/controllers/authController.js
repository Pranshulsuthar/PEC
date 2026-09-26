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
  if (!['student', 'mentor', 'coordinator'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }
  if (role === 'student' && (!req.body.student_id || !req.body.enrollment_no)) {
    return res.status(400).json({ success: false, message: 'Student ID and enrollment number are required' });
  }
  if (role === 'mentor' && (!req.body.mentor_id || !req.body.group_id || !req.body.group_name || !req.body.designation || !req.body.department)) {
    return res.status(400).json({ success: false, message: 'Department, designation, mentor ID, group ID and group name are required' });
  }
  let connection;
  let mentorLock = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (role === 'mentor') {
      const [[lock]] = await connection.query("SELECT GET_LOCK('pec_mentor_registration', 10) AS acquired");
      mentorLock = Number(lock.acquired) === 1;
      if (!mentorLock) throw Object.assign(new Error('Mentor registration is busy. Please try again.'), { statusCode: 409 });
    }
    // Check email exists
    const duplicateField = role === 'student' ? 'student_code' : role === 'mentor' ? 'mentor_code' : null;
    if (duplicateField) {
      const profileTable = role === 'student' ? 'student_profiles' : 'mentor_profiles';
      const profileValue = role === 'student' ? req.body.student_id : req.body.mentor_id;
      const [[existingProfile]] = await connection.query(`SELECT user_id FROM ${profileTable} WHERE ${duplicateField} = ?`, [profileValue]);
      if (existingProfile) throw Object.assign(new Error(role === 'student' ? 'Student ID already exists' : 'Mentor ID already exists'), { statusCode: 409 });
    }
    const [users] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length) {
      throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
    }
    const hashed = await bcrypt.hash(password, 10);
    // Insert into users table
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      [name, email, hashed, role]
    );
    const user_id = result.insertId;
    // Insert into role‑specific table
    if (role === 'student') {
      const { student_id, enrollment_no, branch, semester, year, skills } = req.body;
      await connection.query(
        `INSERT INTO student_profiles (user_id, student_code, roll_number, branch, semester, year, skills) VALUES (?,?,?,?,?,?,?)`,
        [user_id, student_id, enrollment_no, branch || null, semester || year || null, year || null, skills || null]
      );
    } else if (role === 'mentor') {
      const { mentor_id, group_id, group_name, designation, department, experience, skills } = req.body;
      const [[mentorNumberRow]] = await connection.query("SELECT COALESCE(MAX(mentor_number), 0) + 1 AS mentor_number FROM mentor_profiles");
      await connection.query(
        'INSERT INTO mentor_profiles (user_id, mentor_code, mentor_number, group_id, group_name, designation, department, specialization, experience, bio) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [user_id, mentor_id, mentorNumberRow.mentor_number, group_id, group_name, designation || null, department || null, null, experience || null, skills || null]
      );
    } else if (role === 'coordinator') {
      const { designation, department } = req.body;
      const coordinatorCode = `COORD_${user_id}`;
      await connection.query(
        'INSERT INTO coordinator_profiles (user_id, coordinator_code, designation, department, employee_id) VALUES (?,?,?,?,?)',
        [user_id, coordinatorCode, designation || 'Coordinator', department || null, coordinatorCode]
      );
    }
    await connection.commit();
    const token = generateToken({ id: user_id, name, email, role });
    return res.status(201).json({ success: true, message: 'User registered', token, user: { user_id, name, email, role } });
  } catch (err) {
    await connection.rollback();
    console.error('Register error:', err);
    return res.status(err.statusCode || (err.code === 'ER_DUP_ENTRY' ? 409 : 500)).json({ success: false, message: err.statusCode ? err.message : (err.code === 'ER_DUP_ENTRY' ? 'ID or email already exists' : 'Server error') });
  } finally {
    if (mentorLock) {
      try { await connection.query("SELECT RELEASE_LOCK('pec_mentor_registration')"); } catch (error) { console.error('Mentor lock release error:', error); }
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
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = rows[0];
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
