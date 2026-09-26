const pool = require('../config/db');

exports.getAllStudents = async (req, res) => {
  try {
    const [rows] = await pool.query(`
       SELECT u.id AS student_id, sp.student_code, u.name, u.email, sp.roll_number, sp.branch, sp.year, sp.skills,
              ms.id AS assignment_id, ms.mentor_id, mp.mentor_code, mentor.name AS mentor_name
      FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
      LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active'
       LEFT JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor'
       LEFT JOIN mentor_profiles mp ON mp.user_id = mentor.id
       WHERE u.role = 'student' ORDER BY u.name
    `);
    res.json({ success: true, students: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getAllMentors = async (req, res) => {
  try {
    const [rows] = await pool.query(`
       SELECT u.id AS mentor_id, mp.mentor_code, u.name, u.email, mp.specialization, mp.department, mp.group_id, mp.group_name,
              mp.designation, COUNT(ms.student_id) AS assigned_students
      FROM users u LEFT JOIN mentor_profiles mp ON mp.user_id = u.id
      LEFT JOIN mentor_student ms ON ms.mentor_id = u.id AND ms.status = 'active'
      WHERE u.role = 'mentor' GROUP BY u.id, u.name, u.email, mp.mentor_code, mp.specialization, mp.department, mp.group_id, mp.group_name, mp.designation
      ORDER BY u.name
    `);
    res.json({ success: true, mentors: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getEvents = async (req, res) => {
  try {
    const [events] = await pool.query('SELECT e.*, \'Event\' AS category FROM events e ORDER BY e.event_date ASC, e.start_time ASC');
    res.json({ success: true, events });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getSubmissions = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ts.id, ts.task_id, ts.student_id, ts.submission_text, ts.submission_url, ts.submitted_at, ts.status, ts.score, ts.feedback, t.title, t.description AS challenge_description, t.max_score, u.name AS student_name, sp.student_code, mu.name AS mentor_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id AND u.role = 'student' LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active' LEFT JOIN users mu ON mu.id = ms.mentor_id AND mu.role = 'mentor' ORDER BY ts.submitted_at DESC`);
    res.json({ success: true, submissions: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT u.id AS student_id, u.name AS student_name, sp.student_code, mentor.name AS mentor_name, COUNT(DISTINCT CASE WHEN ts.status = 'accepted' THEN ts.task_id END) AS challenges_completed, COALESCE(SUM(CASE WHEN ts.status = 'accepted' THEN ts.score ELSE 0 END), 0) AS points FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN task_submissions ts ON ts.student_id = u.id LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active' LEFT JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE u.role = 'student' GROUP BY u.id, u.name, sp.student_code, mentor.name HAVING challenges_completed > 0 OR points > 0 ORDER BY points DESC, challenges_completed DESC, u.name`);
    res.json({ success: true, leaderboard: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getResources = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, title, description, resource_type, resource_url, category, status, created_at FROM resources WHERE status <> 'archived' ORDER BY created_at DESC`);
    res.json({ success: true, resources: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createResource = async (req, res) => {
  const { title, description, resource_type, resource_url, category, status } = req.body;
  const allowedTypes = ['document', 'video', 'link', 'tutorial', 'pdf', 'github'];
  if (!title || !resource_url || !allowedTypes.includes(resource_type)) return res.status(400).json({ success: false, message: 'Title, resource type, and URL are required' });
  try {
    const [result] = await pool.query('INSERT INTO resources (title, description, resource_type, resource_url, category, uploaded_by, status) VALUES (?,?,?,?,?,?,?)', [String(title).trim(), description || null, resource_type, resource_url, category || null, req.user.user_id, status === 'published' ? 'published' : 'draft']);
    res.status(201).json({ success: true, resource_id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteResource = async (req, res) => {
  try {
    const [result] = await pool.query("UPDATE resources SET status = 'archived' WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Resource not found' });
    res.json({ success: true });
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
      const [[capacity]] = await connection.query("SELECT COUNT(*) AS count FROM mentor_student ms JOIN users student ON student.id = ms.student_id AND student.role = 'student' WHERE ms.mentor_id = ? AND ms.status = 'active'", [mentorId]);
      if (Number(capacity.count) >= 4) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Mentor capacity reached. Maximum 4 mentees are allowed.' });
      }
      const [[activeAssignment]] = await connection.query("SELECT ms.id FROM mentor_student ms JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.student_id = ? AND ms.status = 'active' LIMIT 1", [studentId]);
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
  const { title, description, difficulty, category, deadline, max_score, status, instructions, resources } = req.body;
  const allowedDifficulty = ['Easy', 'Medium', 'Hard'];
  if (!title || !String(title).trim()) return res.status(400).json({ success: false, message: 'Challenge title is required' });
  if (!allowedDifficulty.includes(difficulty)) return res.status(400).json({ success: false, message: 'Valid challenge difficulty is required' });
  const points = Number(max_score);
  if (!Number.isFinite(points) || points < 0 || points > 9999) return res.status(400).json({ success: false, message: 'Points must be between 0 and 9999' });
  if (!['draft', 'published'].includes(status || 'published')) return res.status(400).json({ success: false, message: 'Challenge status is invalid' });
  if (deadline && Number.isNaN(Date.parse(deadline))) return res.status(400).json({ success: false, message: 'Valid deadline is required' });
  const parsedDeadline = deadline ? new Date(deadline) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(deadline)) return res.status(400).json({ success: false, message: 'Valid deadline is required' });
  if (parsedDeadline && Number.isNaN(parsedDeadline.getTime())) return res.status(400).json({ success: false, message: 'Valid deadline is required' });
  if (parsedDeadline && parsedDeadline <= new Date()) return res.status(400).json({ success: false, message: 'Deadline must be in the future' });
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'INSERT INTO tasks (title, description, difficulty, category, deadline, max_score, status, created_by) VALUES (?,?,?,?,?,?,?,?)',
        [String(title).trim(), [description, instructions, resources ? 'Resources: ' + resources : ''].filter(Boolean).join('\n\n') || null, difficulty, category || null, deadline || null, points, status || 'published', req.user.user_id]
      );
      if ((status || 'published') === 'published') {
        await connection.query(`INSERT INTO task_assignments (task_id, student_id, assigned_by, deadline) SELECT ?, u.id, ?, ? FROM users u WHERE u.role = 'student'`, [result.insertId, req.user.user_id, deadline || null]);
      }
      await connection.commit();
      res.status(201).json({ success: true, task_id: result.insertId });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateTask = async (req, res) => {
  const { title, description, difficulty, category, deadline, status } = req.body;
  if (status && !['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid challenge status' });
  if (difficulty && !['Easy', 'Medium', 'Hard'].includes(difficulty)) return res.status(400).json({ success: false, message: 'Invalid challenge difficulty' });
  if (deadline && (Number.isNaN(Date.parse(deadline)) || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(deadline))) return res.status(400).json({ success: false, message: 'Invalid challenge deadline' });
  try {
    const [result] = await pool.query('UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description), difficulty = COALESCE(?, difficulty), category = COALESCE(?, category), deadline = COALESCE(?, deadline), status = COALESCE(?, status) WHERE id = ?', [title || null, description || null, difficulty || null, category || null, deadline || null, status || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Challenge not found' });
    res.json({ success: true, message: 'Task updated' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteTask = async (req, res) => {
  try {
    const [result] = await pool.query("UPDATE tasks SET status = 'archived' WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Challenge not found' });
    res.json({ success: true, message: 'Challenge archived' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createNews = async (req, res) => {
  const { title, content, image_url, category, status } = req.body;
  if (!title || !String(title).trim() || !content || !String(content).trim()) return res.status(400).json({ success: false, message: 'Title and content required' });
  if (status && !['draft', 'published'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid news status' });
  try {
    const [result] = await pool.query(
      'INSERT INTO news (title, content, image_url, category, created_by, status, published_at) VALUES (?,?,?,?,?,?,?)',
      [String(title).trim(), String(content).trim(), image_url || null, category || null, req.user.user_id, status || 'draft', status === 'published' ? new Date() : null]
    );
    res.status(201).json({ success: true, news_id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateNews = async (req, res) => {
  const { title, content, image_url, category, status } = req.body;
  try {
    const [result] = await pool.query('UPDATE news SET title = COALESCE(?, title), content = COALESCE(?, content), image_url = COALESCE(?, image_url), category = COALESCE(?, category), status = COALESCE(?, status), published_at = CASE WHEN ? = \'published\' THEN COALESCE(published_at, NOW()) WHEN ? = \'draft\' THEN NULL ELSE published_at END WHERE id = ?', [title || null, content || null, image_url || null, category || null, status || null, status || null, status || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'News not found' });
    res.json({ success: true, message: 'News updated' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteNews = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM news WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'News not found' });
    res.json({ success: true, message: 'News deleted' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.createEvent = async (req, res) => {
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  if (!title || !event_date || Number.isNaN(Date.parse(event_date))) return res.status(400).json({ success: false, message: 'Title and valid event date required' });
  if (status && !['draft', 'published'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid event status' });
  try {
    const [result] = await pool.query(
      'INSERT INTO events (title, description, event_date, start_time, end_time, location, image_url, status, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [String(title).trim(), description || null, event_date, start_time || null, end_time || null, location || null, image_url || null, status || 'published', req.user.user_id]
    );
    res.status(201).json({ success: true, event_id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.updateEvent = async (req, res) => {
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  try {
    const [result] = await pool.query('UPDATE events SET title = COALESCE(?, title), description = COALESCE(?, description), event_date = COALESCE(?, event_date), start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time), location = COALESCE(?, location), image_url = COALESCE(?, image_url), status = COALESCE(?, status) WHERE id = ?', [title || null, description || null, event_date || null, start_time || null, end_time || null, location || null, image_url || null, status || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, message: 'Event updated' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.deleteEvent = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getNews = async (req, res) => {
  try {
    const [news] = await pool.query('SELECT * FROM news ORDER BY created_at DESC');
    res.json({ success: true, news });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getDashboard = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [[students]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'");
    const [[mentors]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'mentor'");
    const [[tasks]] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE status = 'published'");
    const [[events]] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE event_date >= CURDATE() AND status = 'published'");
    const [[assigned]] = await pool.query("SELECT COUNT(DISTINCT ms.student_id) AS count FROM mentor_student ms JOIN users student ON student.id = ms.student_id AND student.role = 'student' JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.status = 'active'");
    const [[unassigned]] = await pool.query("SELECT COUNT(*) AS count FROM users u WHERE u.role = 'student' AND NOT EXISTS (SELECT 1 FROM mentor_student ms JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.student_id = u.id AND ms.status = 'active')");
    const [[submissions]] = await pool.query('SELECT COUNT(*) AS count FROM task_submissions');
    const [[pendingSubmissions]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions WHERE status = 'submitted'");
    const [[newsCount]] = await pool.query("SELECT COUNT(*) AS count FROM news WHERE status <> 'archived'");
    const [[resourcesCount]] = await pool.query("SELECT COUNT(*) AS count FROM resources WHERE status <> 'archived'");
    const [[publishedEvents]] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE status = 'published' AND event_date >= CURDATE()");
    const [activity] = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 8');
     const [news] = await pool.query("SELECT id, title, content, category, status, created_at, published_at FROM news WHERE status = 'published' ORDER BY created_at DESC LIMIT 8");
    const [recentStudents] = await pool.query("SELECT u.id, u.name, u.email, sp.student_code, sp.branch, sp.year, u.created_at FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.role = 'student' ORDER BY u.created_at DESC LIMIT 6");
    const [recentSubmissions] = await pool.query("SELECT ts.id, ts.status, ts.submitted_at, ts.score, t.title, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id ORDER BY ts.submitted_at DESC LIMIT 5");
    const [upcomingEvents] = await pool.query("SELECT * FROM events WHERE status = 'published' AND event_date >= CURDATE() ORDER BY event_date ASC LIMIT 5");
    res.json({ success: true, stats: { students: Number(students.count), mentors: Number(mentors.count), assignedMentees: Number(assigned.count), unassignedStudents: Number(unassigned.count), tasks: Number(tasks.count), submissions: Number(submissions.count), pendingSubmissions: Number(pendingSubmissions.count), events: Number(publishedEvents.count), upcomingEvents: Number(events.count), news: Number(newsCount.count), resources: Number(resourcesCount.count) }, activity, news, recentStudents, recentSubmissions, upcomingEvents });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
