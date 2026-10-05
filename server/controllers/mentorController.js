const pool = require('../config/db');
// List all mentors (basic info)
exports.getAll = async (req, res) => {
  if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
  try {
    const [rows] = await pool.query('SELECT mp.id AS profile_id, u.id AS user_id, u.name, u.email, mp.specialization, mp.experience, mp.bio FROM mentor_profiles mp JOIN users u ON mp.user_id = u.id');
    res.json({ success: true, mentors: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get mentor profile + assigned students
exports.getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid mentor ID is required' });
  if (!['mentor', 'coordinator'].includes(req.user.role) || req.user.role === 'mentor' && id !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'Mentors may only access their own profile' });
  try {
    const [rows] = await pool.query(
      `SELECT mp.*, u.name, u.email FROM mentor_profiles mp JOIN users u ON mp.user_id = u.id WHERE mp.user_id = ? AND u.role = 'mentor'`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Mentor not found' });
    const mentor = rows[0];
    // Assigned students
      const [studentRows] = await pool.query(
       `SELECT sp.id AS profile_id, u.id AS student_id, u.name AS student_name, u.email, sp.branch, sp.roll_number, COUNT(DISTINCT ta.task_id) AS assigned_tasks, COUNT(DISTINCT CASE WHEN ts.status = 'accepted' THEN ts.task_id END) AS completed_tasks, COALESCE(AVG(CASE WHEN ts.status = 'accepted' THEN ts.score END), 0) AS average_score
        FROM mentor_student ms JOIN users u ON ms.student_id = u.id AND u.role = 'student'
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN task_assignments ta ON ta.student_id = u.id
        LEFT JOIN task_submissions ts ON ts.student_id = u.id AND ts.task_id = ta.task_id
        WHERE ms.mentor_id = ? AND ms.status = 'active' GROUP BY sp.id, u.id, u.name, u.email, sp.branch, sp.roll_number`,
      [id]
    );
    mentor.assigned_students = studentRows;
    res.json({ success: true, mentor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update mentor profile (self)
exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, expertise, bio, phone, designation, department } = req.body;
  if (req.user.role !== 'mentor' || id !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'Mentors may only update their own profile' });
  if (name && String(name).trim().length > 160) return res.status(400).json({ success: false, message: 'Name is too long' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone) WHERE id = ? AND role = \'mentor\'', [name ? String(name).trim() : null, email ? String(email).trim().toLowerCase() : null, phone || null, id]);
      await connection.query('UPDATE mentor_profiles SET designation = COALESCE(?, designation), department = COALESCE(?, department), specialization = COALESCE(?, specialization), bio = COALESCE(?, bio) WHERE user_id = ?', [designation || null, department || null, expertise || null, bio === undefined ? null : bio, id]);
      await connection.commit();
      res.json({ success: true, message: 'Mentor profile updated' });
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email already exists' });
      throw error;
    } finally { connection.release(); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createFeedback = async (req, res) => {
  const mentorId = Number(req.params.id);
  const studentId = Number(req.body.student_id);
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const rating = Number(req.body.rating);
  if (mentorId !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'You may submit feedback only as yourself' });
  if (!Number.isInteger(studentId) || studentId < 1 || !message || message.length > 10000 || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Student, feedback, and a 1–5 rating are required' });
  try {
    const [[assigned]] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [mentorId, studentId]);
    if (!assigned) return res.status(403).json({ success: false, message: 'Feedback is limited to your assigned mentees' });
    const [result] = await pool.query("INSERT INTO feedback (student_id, mentor_id, `message`, rating, status) VALUES (?,?,?,?, 'closed')", [studentId, mentorId, message, rating]);
    await pool.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [studentId, 'Mentor feedback received', message, 'feedback']);
    res.status(201).json({ success: true, feedback_id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getFeedback = async (req, res) => {
  const mentorId = Number(req.params.id);
  const studentId = req.user.role === 'student' ? Number(req.user.user_id) : Number(req.query.student_id);
  if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ success: false, message: 'Student ID is required' });
  if (req.user.role === 'mentor' && mentorId !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'Mentors may only view their own feedback' });
  try {
    if (req.user.role === 'mentor') {
      const [[assigned]] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [mentorId, studentId]);
      if (!assigned) return res.status(403).json({ success: false, message: 'Student is not assigned to this mentor' });
    } else if (req.user.role === 'student') {
      const [[assigned]] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [mentorId, studentId]);
      if (!assigned) return res.status(403).json({ success: false, message: 'Feedback is not available for this student' });
    } else if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Role not permitted' });
    const [rows] = await pool.query('SELECT id, student_id, mentor_id, `message`, rating, status, created_at FROM feedback WHERE mentor_id = ? AND student_id = ? ORDER BY created_at DESC', [mentorId, studentId]);
    res.json({ success: true, feedback: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

// Get mentees assigned to this mentor (protected)
exports.getMentees = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid mentor ID is required' });
    if (!['mentor', 'coordinator'].includes(req.user.role) || req.user.role === 'mentor' && id !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'Mentors may only access their own mentees' });
  try {
    const [rows] = await pool.query(
      `SELECT sp.id AS profile_id, u.id AS student_id, sp.student_code, u.name, u.email, sp.branch, sp.year, sp.roll_number, sp.skills, COUNT(DISTINCT ta.task_id) AS assigned_tasks, COUNT(DISTINCT CASE WHEN ts.status = 'accepted' THEN ts.task_id END) AS completed_tasks, COALESCE(AVG(CASE WHEN ts.status = 'accepted' THEN ts.score END), 0) AS average_score
       FROM mentor_student ms JOIN users u ON ms.student_id = u.id AND u.role = 'student'
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN task_assignments ta ON ta.student_id = u.id
       LEFT JOIN task_submissions ts ON ts.student_id = u.id AND ts.task_id = ta.task_id
       WHERE ms.mentor_id = ? AND ms.status = 'active' GROUP BY sp.id, u.id, sp.student_code, u.name, u.email, sp.branch, sp.year, sp.roll_number, sp.skills ORDER BY u.name`,
      [id]
    );
    res.json({ success: true, mentees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
