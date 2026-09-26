const pool = require('../config/db');

// Get list of students (basic info)
exports.getAll = async (req, res) => {
  if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
  try {
    const [rows] = await pool.query('SELECT sp.id AS profile_id, u.id AS user_id, u.name, u.email, sp.roll_number, sp.branch, sp.semester, sp.phone FROM student_profiles sp JOIN users u ON sp.user_id = u.id');
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
       `SELECT sp.*, u.id AS user_id, u.name, u.email FROM student_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.user_id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const student = rows[0];
    // Find assigned mentor via mentor_students
    const [mentorRows] = await pool.query(
      `SELECT u.id AS mentor_id, u.name AS mentor_name, u.email, mp.specialization
       FROM mentor_student ms JOIN users u ON ms.mentor_id = u.id
       LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
       WHERE ms.student_id = ? AND ms.status = 'active' LIMIT 1`,
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
  const id = req.params.id;
  const { name, email, enrollment_no, branch, year, semester, section, github_url, linkedin_url } = req.body;
  // Ensure the logged‑in user matches
  if (parseInt(id) !== parseInt(req.user.user_id)) {
    return res.status(403).json({ success: false, message: 'Cannot modify other students' });
  }
  try {
    const [[currentProfile]] = await pool.query('SELECT student_code FROM student_profiles WHERE user_id = ?', [req.user.user_id]);
    if (!currentProfile) return res.status(404).json({ success: false, message: 'Student profile not found' });
    await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.user_id]);
    await pool.query(
      `UPDATE student_profiles SET roll_number = ?, branch = ?, semester = ?, section = ?, year = ?, github_url = ?, linkedin_url = ? WHERE user_id = ?`,
      [enrollment_no || currentProfile.student_code, branch, semester, section, year, github_url, linkedin_url, req.user.user_id]
    );
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
    const [rows] = await pool.query('SELECT sp.*, u.name, u.email FROM student_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const student = rows[0];
    const [mentorRows] = await pool.query(
      `SELECT u.id AS mentor_id, u.name AS mentor_name, u.email, mp.specialization
       FROM mentor_student ms JOIN users u ON ms.mentor_id = u.id
       LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
       WHERE ms.student_id = ? AND ms.status = 'active' LIMIT 1`,
      [req.user.user_id]
    );
    student.assigned_mentor = mentorRows[0] || null;
    res.json({ success: true, user: req.user, student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
