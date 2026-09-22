const pool = require('../config/db');

exports.getAllStudents = async (req, res) => {
  try {
    const [rows] = await pool.query(`
       SELECT u.id AS student_id, sp.student_code, u.name, u.email, sp.roll_number, sp.branch, sp.year,
              ms.mentor_id, mp.mentor_code, mentor.name AS mentor_name
      FROM users u JOIN student_profiles sp ON sp.user_id = u.id
      LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active'
       LEFT JOIN users mentor ON mentor.id = ms.mentor_id
       LEFT JOIN mentor_profiles mp ON mp.user_id = ms.mentor_id
       WHERE u.role = 'student' ORDER BY u.name
    `);
    res.json({ success: true, students: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getAllMentors = async (req, res) => {
  try {
    const [rows] = await pool.query(`
       SELECT u.id AS mentor_id, mp.mentor_code, u.name, u.email, mp.specialization, mp.department,
              COUNT(ms.student_id) AS assigned_students
      FROM users u JOIN mentor_profiles mp ON mp.user_id = u.id
      LEFT JOIN mentor_student ms ON ms.mentor_id = u.id AND ms.status = 'active'
      WHERE u.role = 'mentor' GROUP BY u.id, u.name, u.email, mp.specialization, mp.department
      ORDER BY u.name
    `);
    res.json({ success: true, mentors: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.assignMentorToStudent = async (req, res) => {
  const { mentor_id, student_id } = req.body;
  if (!mentor_id || !student_id) return res.status(400).json({ success: false, message: 'mentor_id and student_id required' });
  try {
    const [[mentor]] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'mentor'", [mentor_id]);
    const [[student]] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'student'", [student_id]);
    if (!mentor || !student) return res.status(404).json({ success: false, message: 'Valid mentor and student are required' });
    const [[existing]] = await pool.query("SELECT id FROM mentor_student WHERE student_id = ? AND status = 'active' LIMIT 1", [student_id]);
    if (existing) return res.status(409).json({ success: false, message: 'Student already has an active mentor' });
    await pool.query(`
      INSERT INTO mentor_student (mentor_id, student_id, assigned_by, status) VALUES (?, ?, ?, 'active')
      ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by), status = 'active'
    `, [mentor_id, student_id, req.user.user_id]);
    res.json({ success: true, message: 'Mentor assigned to student' });
  } catch (err) {
    console.error(err);
    const status = err.code === 'ER_SIGNAL_EXCEPTION' ? 409 : 500;
    res.status(status).json({ success: false, message: err.code === 'ER_SIGNAL_EXCEPTION' ? err.sqlMessage : 'Server error' });
  }
};

exports.unassignMentor = async (req, res) => {
  try { await pool.query('UPDATE mentor_student SET status = "inactive" WHERE id = ?', [req.params.id]); res.json({ success: true, message: 'Assignment deactivated' }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createTask = async (req, res) => {
  const { title, description, difficulty, category, deadline, status } = req.body;
  if (!title) return res.status(400).json({ success: false, message: 'Title required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO tasks (title, description, difficulty, category, deadline, status, created_by) VALUES (?,?,?,?,?,?,?)',
      [title, description || null, difficulty || 'Easy', category || null, deadline || null, status || 'published', req.user.user_id]
    );
    res.status(201).json({ success: true, task_id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateTask = async (req, res) => {
  const { title, description, difficulty, category, deadline, status } = req.body;
  try {
    await pool.query('UPDATE tasks SET title = ?, description = ?, difficulty = ?, category = ?, deadline = ?, status = ? WHERE id = ?', [title, description, difficulty, category, deadline, status, req.params.id]);
    res.json({ success: true, message: 'Task updated' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteTask = async (req, res) => {
  try { await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]); res.json({ success: true, message: 'Task deleted' }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createNews = async (req, res) => {
  const { title, content, image_url, category, status } = req.body;
  if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO news (title, content, image_url, category, created_by, status, published_at) VALUES (?,?,?,?,?,?,?)',
      [title, content, image_url || null, category || null, req.user.user_id, status || 'draft', status === 'published' ? new Date() : null]
    );
    res.status(201).json({ success: true, news_id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateNews = async (req, res) => {
  const { title, content, image_url, category, status } = req.body;
  try {
    await pool.query('UPDATE news SET title = ?, content = ?, image_url = ?, category = ?, status = ?, published_at = ? WHERE id = ?', [title, content, image_url || null, category || null, status, status === 'published' ? new Date() : null, req.params.id]);
    res.json({ success: true, message: 'News updated' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteNews = async (req, res) => {
  try { await pool.query('DELETE FROM news WHERE id = ?', [req.params.id]); res.json({ success: true, message: 'News deleted' }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createEvent = async (req, res) => {
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  if (!title || !event_date) return res.status(400).json({ success: false, message: 'Title and date required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO events (title, description, event_date, start_time, end_time, location, image_url, status, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [title, description || null, event_date, start_time || null, end_time || null, location || null, image_url || null, status || 'published', req.user.user_id]
    );
    res.status(201).json({ success: true, event_id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateEvent = async (req, res) => {
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  try {
    await pool.query('UPDATE events SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, location = ?, image_url = ?, status = ? WHERE id = ?', [title, description, event_date, start_time, end_time, location, image_url, status, req.params.id]);
    res.json({ success: true, message: 'Event updated' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteEvent = async (req, res) => {
  try { await pool.query('DELETE FROM events WHERE id = ?', [req.params.id]); res.json({ success: true, message: 'Event deleted' }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getDashboard = async (req, res) => {
  try {
    const [[students]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'");
    const [[mentors]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'mentor'");
    const [[tasks]] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE status = 'published'");
    const [[events]] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE event_date >= CURDATE() AND status = 'published'");
    const [activity] = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 8');
    const [news] = await pool.query('SELECT * FROM news ORDER BY created_at DESC LIMIT 8');
    res.json({ success: true, stats: { students: students.count, mentors: mentors.count, tasks: tasks.count, events: events.count }, activity, news });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
