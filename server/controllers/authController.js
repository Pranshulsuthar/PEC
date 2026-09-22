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
  const connection = await pool.getConnection();
  let mentorLock = false;
  try {
    await connection.beginTransaction();

    if (role === 'mentor') {
      const [[lock]] = await connection.query("SELECT GET_LOCK('pec_mentor_registration', 10) AS acquired");
      mentorLock = Number(lock.acquired) === 1;
      if (!mentorLock) throw Object.assign(new Error('Mentor registration is busy. Please try again.'), { statusCode: 409 });
      const [[mentorCount]] = await connection.query("SELECT COUNT(*) AS count FROM users WHERE role = 'mentor'");
      if (Number(mentorCount.count) >= 16) {
        throw Object.assign(new Error('Mentor capacity has been reached. Maximum 16 mentors are allowed.'), { statusCode: 409 });
      }
    }
    // Check email exists
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
      const { student_id, group_id, roll_number, branch, semester, year, skills } = req.body;
      const [[studentNumber]] = await connection.query("SELECT COUNT(*) + 100 AS next_number FROM users WHERE role = 'student'");
      const studentCode = student_id || `PEC_${studentNumber.next_number}`;
      await connection.query(
        `INSERT INTO student_profiles (user_id, student_code, group_id, roll_number, branch, semester, year, skills) VALUES (?,?,?,?,?,?,?,?)`,
        [user_id, studentCode, group_id || null, roll_number || null, branch || null, semester || null, year || null, skills || null]
      );
      const [mentors] = await connection.query("SELECT u.id FROM users u JOIN mentor_profiles mp ON mp.user_id = u.id WHERE u.role = 'mentor' AND (? IS NULL OR mp.group_id = ?) ORDER BY mp.mentor_number, u.id FOR UPDATE", [group_id || null, group_id || null]);
      for (const mentor of mentors) {
        const [[assigned]] = await connection.query("SELECT COUNT(*) AS count FROM mentor_student WHERE mentor_id = ? AND status = 'active'", [mentor.id]);
        if (Number(assigned.count) < 4) {
          await connection.query("INSERT INTO mentor_student (mentor_id, student_id, assigned_by, status) VALUES (?, ?, NULL, 'active')", [mentor.id, user_id]);
          break;
        }
      }
    } else if (role === 'mentor') {
      const { mentor_id, group_id, group_name, designation, department, experience, skills } = req.body;
      if (!group_id || !group_name) {
        throw Object.assign(new Error('Group ID and group name are required'), { statusCode: 400 });
      }
      const [[mentorNumberRow]] = await connection.query("SELECT COALESCE(MAX(mentor_number), 0) + 1 AS mentor_number FROM mentor_profiles");
      if (Number(mentorNumberRow.mentor_number) > 16) {
        throw Object.assign(new Error('Mentor capacity has been reached. Maximum 16 mentors are allowed.'), { statusCode: 409 });
      }
      if (!mentor_id) {
        throw Object.assign(new Error('Mentor ID is required'), { statusCode: 400 });
      }
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
    connection.release();
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
