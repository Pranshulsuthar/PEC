const pool = require('../config/db');
const { publishDashboardUpdate } = require('../services/realtime');

async function resolveConversation(req) {
  const mentorId = Number(req.params.id);
  if (!Number.isInteger(mentorId) || mentorId < 1) return { error: 'Valid mentor ID is required', status: 400 };
  let studentId;
  if (req.user.role === 'mentor') {
    if (mentorId !== Number(req.user.user_id)) return { error: 'Mentors may only access their own conversations', status: 403 };
    studentId = Number((req.query && req.query.student_id) || (req.body && req.body.student_id));
    if (!Number.isInteger(studentId) || studentId < 1) return { error: 'Valid student ID is required', status: 400 };
  } else if (req.user.role === 'student') {
    studentId = Number(req.user.user_id);
  } else {
    return { error: 'Mentor or student access required', status: 403 };
  }
  const [[assignment]] = await pool.query("SELECT 1 AS assigned FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active' LIMIT 1", [mentorId, studentId]);
  if (!assignment) return { error: 'An active mentor assignment is required to message', status: 403 };
  return { mentorId, studentId };
}

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

exports.createNews = async (req, res) => {
  const mentorId = Number(req.params.id);
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
  if (mentorId !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'Mentors may only post announcements as themselves' });
  if (!title || title.length > 255 || !content || content.length > 20000 || category.length > 100) return res.status(400).json({ success: false, message: 'Enter a title, message, and category within the allowed lengths' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [mentees] = await connection.query("SELECT student_id FROM mentor_student WHERE mentor_id = ? AND status = 'active'", [mentorId]);
    if (!mentees.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'You need an assigned mentee before posting an announcement' });
    }
    const [newsResult] = await connection.query("INSERT INTO news (title, content, category, created_by, status, published_at) VALUES (?,?,?,?, 'published', NOW())", [title, content, category || 'Mentor announcement', mentorId]);
    const recipientIds = mentees.map((mentee) => Number(mentee.student_id));
    for (const studentId of recipientIds) {
      await connection.query('INSERT INTO news_recipients (news_id, user_id) VALUES (?, ?)', [newsResult.insertId, studentId]);
      await connection.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [studentId, title, content, 'news']);
    }
    await connection.commit();
    publishDashboardUpdate(req, { userIds: [...recipientIds, mentorId], resource: 'mentor.news.created' });
    res.status(201).json({ success: true, news_id: newsResult.insertId, recipient_count: recipientIds.length });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error(rollbackError); }
    console.error(err);
    res.status(500).json({ success: false, message: 'Unable to post announcement' });
  } finally {
    connection.release();
  }
};

exports.getMessages = async (req, res) => {
  try {
    const conversation = await resolveConversation(req);
    if (conversation.error) return res.status(conversation.status).json({ success: false, message: conversation.error });
    await pool.query('UPDATE mentor_messages SET read_at = CURRENT_TIMESTAMP WHERE mentor_id = ? AND student_id = ? AND sender_id <> ? AND read_at IS NULL', [conversation.mentorId, conversation.studentId, req.user.user_id]);
    const [messages] = await pool.query('SELECT m.id, m.mentor_id, m.student_id, m.sender_id, m.body, m.read_at, m.created_at, u.name AS sender_name FROM mentor_messages m JOIN users u ON u.id = m.sender_id WHERE m.mentor_id = ? AND m.student_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 200', [conversation.mentorId, conversation.studentId]);
    res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Unable to load messages' });
  }
};

exports.sendMessage = async (req, res) => {
  const body = typeof (req.body || {}).body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 5000) return res.status(400).json({ success: false, message: 'Enter a message of up to 5,000 characters' });
  let connection;
  try {
    const conversation = await resolveConversation(req);
    if (conversation.error) return res.status(conversation.status).json({ success: false, message: conversation.error });
    const recipientId = Number(req.user.user_id) === conversation.mentorId ? conversation.studentId : conversation.mentorId;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query('INSERT INTO mentor_messages (mentor_id, student_id, sender_id, body) VALUES (?,?,?,?)', [conversation.mentorId, conversation.studentId, req.user.user_id, body]);
    await connection.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [recipientId, 'New mentor message', body, 'message']);
    await connection.commit();
    publishDashboardUpdate(req, { userIds: [conversation.mentorId, conversation.studentId], resource: 'mentor.message.created' });
    res.status(201).json({ success: true, message_id: result.insertId });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error(rollbackError); }
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Unable to send message' });
  } finally {
    if (connection) connection.release();
  }
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
