const pool = require('../config/db');

exports.getAllStudents = async (req, res) => {
  try {
    const [rows] = await pool.query(`
       SELECT u.id AS student_id, sp.student_code, u.name, u.email, sp.roll_number, sp.branch, sp.year,
              ms.id AS assignment_id, ms.mentor_id, mp.mentor_code, mentor.name AS mentor_name
      FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
      LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active'
       LEFT JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor'
       LEFT JOIN mentor_profiles mp ON mp.user_id = ms.mentor_id
       WHERE u.role = 'student' ORDER BY u.name
    `);
    res.json({ success: true, students: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getAllMentors = async (req, res) => {
  try {
    const [rows] = await pool.query(`
       SELECT u.id AS mentor_id, mp.mentor_code, u.name, u.email, mp.specialization, mp.department, mp.group_id, mp.group_name,
              COUNT(ms.student_id) AS assigned_students
      FROM users u JOIN mentor_profiles mp ON mp.user_id = u.id
      LEFT JOIN mentor_student ms ON ms.mentor_id = u.id AND ms.status = 'active'
      WHERE u.role = 'mentor' GROUP BY u.id, u.name, u.email, mp.mentor_code, mp.specialization, mp.department, mp.group_id, mp.group_name
      ORDER BY u.name
    `);
    res.json({ success: true, mentors: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.listAssignments = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ms.id AS assignment_id, ms.assigned_at, u.id AS student_id, u.name AS student_name, sp.student_code, sp.roll_number, mu.id AS mentor_id, mu.name AS mentor_name, mp.mentor_code FROM mentor_student ms JOIN users u ON u.id = ms.student_id AND u.role = 'student' JOIN users mu ON mu.id = ms.mentor_id AND mu.role = 'mentor' LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN mentor_profiles mp ON mp.user_id = mu.id WHERE ms.status = 'active' ORDER BY ms.assigned_at DESC`);
    res.json({ success: true, assignments: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.assignMentorToStudent = async (req, res) => {
  const mentorId = Number(req.body.mentor_id);
  const studentId = Number(req.body.student_id);
  if (!Number.isInteger(mentorId) || !Number.isInteger(studentId) || mentorId < 1 || studentId < 1) {
    return res.status(400).json({ success: false, message: 'Valid mentor_id and student_id are required' });
  }
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('SELECT id FROM users WHERE role IN (\'mentor\', \'student\') ORDER BY id FOR UPDATE');
      const [[mentor]] = await connection.query("SELECT id FROM users WHERE id = ? AND role = 'mentor'", [mentorId]);
      const [[student]] = await connection.query("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
      if (!mentor || !student) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Valid mentor and student are required' });
      }
      const [[existing]] = await connection.query("SELECT id, mentor_id FROM mentor_student WHERE student_id = ? AND status = 'active' LIMIT 1 FOR UPDATE", [studentId]);
      if (existing && Number(existing.mentor_id) === mentorId) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Student is already assigned to this mentor' });
      }
      if (existing) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Student is already assigned to another mentor. Remove the current assignment first.' });
      }
      const [[capacity]] = await connection.query("SELECT COUNT(*) AS count FROM mentor_student WHERE mentor_id = ? AND status = 'active'", [mentorId]);
      if (Number(capacity.count) >= 4) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Mentor capacity reached. Maximum 4 mentees are allowed.' });
      }
      const [[activeAssignment]] = await connection.query("SELECT id FROM mentor_student WHERE student_id = ? AND status = 'active' LIMIT 1", [studentId]);
      if (activeAssignment) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Student is already assigned to an active mentor.' });
      }
      const [[previous]] = await connection.query('SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? LIMIT 1', [mentorId, studentId]);
      if (previous) {
        await connection.query("UPDATE mentor_student SET assigned_by = ?, assigned_at = CURRENT_TIMESTAMP, status = 'active' WHERE id = ?", [req.user.user_id, previous.id]);
      } else {
        await connection.query("INSERT INTO mentor_student (mentor_id, student_id, assigned_by, status) VALUES (?, ?, ?, 'active')", [mentorId, studentId, req.user.user_id]);
      }
      await connection.commit();
      res.status(201).json({ success: true, message: 'Mentor assigned to student' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error(err);
    const status = err.code === 'ER_SIGNAL_EXCEPTION' ? 409 : 500;
    res.status(status).json({ success: false, message: err.code === 'ER_SIGNAL_EXCEPTION' ? err.sqlMessage : 'Server error' });
  }
};

exports.unassignMentor = async (req, res) => {
  const assignmentId = Number(req.params.id);
  if (!Number.isInteger(assignmentId) || assignmentId < 1) return res.status(400).json({ success: false, message: 'Valid assignment ID is required' });
  try {
    const [result] = await pool.query("UPDATE mentor_student SET status = 'inactive' WHERE id = ? AND status = 'active'", [assignmentId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Active assignment not found' });
    res.json({ success: true, message: 'Assignment removed' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
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
      const [[assigned]] = await pool.query("SELECT COUNT(DISTINCT student_id) AS count FROM mentor_student WHERE status = 'active'");
      const [[unassigned]] = await pool.query("SELECT COUNT(*) AS count FROM users u LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active' WHERE u.role = 'student' AND ms.id IS NULL");
      const [[pendingSubmissions]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions WHERE status = 'submitted'");
      const [activity] = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 8');
    const [news] = await pool.query('SELECT * FROM news ORDER BY created_at DESC LIMIT 8');
    res.json({ success: true, stats: { students: Number(students.count), mentors: Number(mentors.count), assignedMentees: Number(assigned.count), unassignedStudents: Number(unassigned.count), tasks: Number(tasks.count), events: Number(events.count), pendingSubmissions: Number(pendingSubmissions.count) }, activity, news });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
