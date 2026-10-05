const pool = require('../config/db');

// Get list of students (basic info)
exports.getAll = async (req, res) => {
  if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
  try {
    const [rows] = await pool.query("SELECT sp.id AS profile_id, u.id AS user_id, u.name, u.email, sp.student_code, sp.roll_number, sp.branch, sp.semester, sp.year, sp.phone, sp.skills, ms.mentor_id, mentor.name AS mentor_name, mp.mentor_code FROM student_profiles sp JOIN users u ON sp.user_id = u.id LEFT JOIN mentor_student ms ON ms.id = (SELECT ms2.id FROM mentor_student ms2 JOIN users mentor_user ON mentor_user.id = ms2.mentor_id AND mentor_user.role = 'mentor' WHERE ms2.student_id = u.id AND ms2.status = 'active' ORDER BY ms2.assigned_at DESC, ms2.id DESC LIMIT 1) LEFT JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' LEFT JOIN mentor_profiles mp ON mp.user_id = mentor.id WHERE u.role = 'student'");
    res.json({ success: true, students: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get a single student profile (including mentor assignment)
exports.getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid student ID is required' });
  if (!['student', 'mentor', 'coordinator'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Role not permitted' });
  if (req.user.role === 'student' && Number(id) !== Number(req.user.user_id)) {
    return res.status(403).json({ success: false, message: 'You can only access your own profile' });
  }
  if (req.user.role === 'mentor') {
    try {
      const [assigned] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [req.user.user_id, id]);
      if (!assigned.length) return res.status(403).json({ success: false, message: 'You can only access students assigned to you' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  try {
    const [rows] = await pool.query(
       `SELECT sp.*, u.id AS user_id, u.name, u.email FROM student_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.user_id = ? AND u.role = 'student'`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const student = rows[0];
    // Find assigned mentor via mentor_students
    const [mentorRows] = await pool.query(
       `SELECT u.id AS mentor_id, u.name AS mentor_name, u.email, mp.specialization, mp.designation, mp.group_id, mp.group_name
        FROM mentor_student ms JOIN users u ON ms.mentor_id = u.id AND u.role = 'mentor'
        LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
        WHERE ms.student_id = ? AND ms.status = 'active' ORDER BY ms.assigned_at DESC, ms.id DESC LIMIT 1`,
      [id]
    );
    student.assigned_mentor = mentorRows[0] || null;
    res.json({ success: true, student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update own profile (limited fields)
exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, enrollment_no, branch, year, semester, section, github_url, linkedin_url, phone, skills } = req.body;
  if (Number(req.user.user_id) !== id || req.user.role !== 'student') return res.status(403).json({ success: false, message: 'Cannot modify other student profiles' });
  if (!name || String(name).trim().length > 160 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid name and email address' });
  try {
    if (enrollment_no && String(enrollment_no).length > 50) return res.status(400).json({ success: false, message: 'Enrollment number is too long' });
    const [[currentProfile]] = await pool.query('SELECT student_code, roll_number FROM student_profiles WHERE user_id = ?', [req.user.user_id]);
    if (!currentProfile) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const nextEnrollment = enrollment_no || currentProfile.roll_number;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [String(name).trim(), String(email).trim().toLowerCase(), req.user.user_id]);
      await connection.query(
        `UPDATE student_profiles SET roll_number = ?, branch = ?, semester = ?, section = ?, year = ?, github_url = ?, linkedin_url = ?, phone = ?, skills = ? WHERE user_id = ?`,
        [nextEnrollment, branch || null, semester || null, section || null, year || null, github_url || null, linkedin_url || null, phone || null, skills || null, req.user.user_id]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email or enrollment number already exists' });
      throw error;
    } finally { connection.release(); }
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get current logged-in student's profile
exports.getMe = async (req, res) => {
  const userId = req.user.user_id;
  try {
    if (req.user.role !== 'student') return res.status(403).json({ success: false, message: 'Student access required' });
    const [rows] = await pool.query("SELECT sp.*, u.id AS user_id, u.name, u.email FROM student_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.id = ? AND u.role = 'student'", [userId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const student = rows[0];
    const [mentorRows] = await pool.query(
       `SELECT u.id AS mentor_id, u.name AS mentor_name, u.email, mp.specialization, mp.designation, mp.group_id, mp.group_name
        FROM mentor_student ms JOIN users u ON ms.mentor_id = u.id AND u.role = 'mentor'
        LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
        WHERE ms.student_id = ? AND ms.status = 'active' ORDER BY ms.assigned_at DESC, ms.id DESC LIMIT 1`,
      [req.user.user_id]
    );
    student.assigned_mentor = mentorRows[0] || null;
    res.json({ success: true, user: req.user, student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
