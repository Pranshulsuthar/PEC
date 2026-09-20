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
  if (role === 'coordinator') {
    const [coordinators] = await pool.query("SELECT id FROM users WHERE role = 'coordinator' LIMIT 1");
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let requesterIsCoordinator = false;
    if (token) {
      try {
        const requester = jwt.verify(token, process.env.JWT_SECRET || 'change_this_to_a_secure_secret');
        requesterIsCoordinator = requester.role === 'coordinator';
      } catch (error) { requesterIsCoordinator = false; }
    }
    if (coordinators.length && !requesterIsCoordinator) {
      return res.status(403).json({ success: false, message: 'Coordinator accounts require approval from an existing coordinator' });
    }
  }
  const connection = await pool.getConnection();
  try {
    // Check email exists
    const [users] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await connection.beginTransaction();
    // Insert into users table
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      [name, email, hashed, role]
    );
    const user_id = result.insertId;
    // Insert into role‑specific table
    if (role === 'student') {
      const { roll_number, branch, semester, year, skills } = req.body;
      await connection.query(
        `INSERT INTO student_profiles (user_id, roll_number, branch, semester, year, skills) VALUES (?,?,?,?,?,?)`,
        [user_id, roll_number || null, branch || null, semester || null, year || null, skills || null]
      );
    } else if (role === 'mentor') {
      const { designation, department, specialization, experience, skills } = req.body;
      await connection.query(
        'INSERT INTO mentor_profiles (user_id, designation, department, specialization, experience, bio) VALUES (?,?,?,?,?,?)',
        [user_id, designation || null, department || null, specialization || null, experience || null, skills || null]
      );
    } else if (role === 'coordinator') {
      const { designation, department, employee_id } = req.body;
      await connection.query(
        'INSERT INTO coordinator_profiles (user_id, designation, department, employee_id) VALUES (?,?,?,?)',
        [user_id, designation || 'Coordinator', department || null, employee_id || null]
      );
    }
    await connection.commit();
    const token = generateToken({ id: user_id, name, email, role });
    return res.status(201).json({ success: true, message: 'User registered', token, user: { user_id, name, email, role } });
  } catch (err) {
    await connection.rollback();
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
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
