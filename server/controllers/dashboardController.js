const pool = require('../config/db');

async function getNews() {
  const [rows] = await pool.query("SELECT id, title, content, category, created_at, published_at FROM news WHERE status = 'published' ORDER BY created_at DESC LIMIT 6");
  return rows;
}

async function getEvents() {
  const [rows] = await pool.query("SELECT id, title, description, event_date, start_time, end_time, location FROM events WHERE status = 'published' AND event_date >= CURDATE() ORDER BY event_date ASC LIMIT 6");
  return rows;
}

exports.student = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [[profile]] = await pool.query(`SELECT u.name, u.email, sp.* FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = ? AND u.role = 'student'`, [userId]);
    if (!profile) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const [mentor] = await pool.query(`SELECT u.id, u.name, u.email, mp.mentor_code, mp.specialization, mp.department FROM mentor_student ms JOIN users u ON u.id = ms.mentor_id LEFT JOIN mentor_profiles mp ON mp.user_id = u.id WHERE ms.student_id = ? AND ms.status = 'active' LIMIT 1`, [userId]);
    const [tasks] = await pool.query(`SELECT t.id, t.title, t.description, t.difficulty, t.deadline, ta.status AS assignment_status FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id WHERE ta.student_id = ? ORDER BY ta.deadline ASC LIMIT 8`, [userId]);
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', [userId]);
    res.json({ success: true, profile, mentor: mentor[0] || null, tasks, progress: { total_tasks: tasks.length, completed_tasks: 0, current_streak: 0, rank: 0, progress_percentage: 0 }, skills: [], achievements: [], resources: [], attendance: [], notifications, news: [], events: [] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.mentor = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [[profile]] = await pool.query(`SELECT u.name, u.email, mp.* FROM users u LEFT JOIN mentor_profiles mp ON mp.user_id = u.id WHERE u.id = ? AND u.role = 'mentor'`, [userId]);
    if (!profile) return res.status(404).json({ success: false, message: 'Mentor profile not found' });
    const [students] = await pool.query(`SELECT u.id, u.name, u.email, sp.student_code, sp.branch, sp.year, sp.roll_number, 0 AS progress_percentage FROM mentor_student ms JOIN users u ON u.id = ms.student_id LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE ms.mentor_id = ? AND ms.status = 'active' ORDER BY u.name`, [userId]);
    const [submissions] = await pool.query(`SELECT ts.id, ts.status, ts.score, ts.submitted_at, t.title, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN mentor_student ms ON ms.student_id = ts.student_id AND ms.mentor_id = ? AND ms.status = 'active' JOIN users u ON u.id = ts.student_id ORDER BY ts.submitted_at DESC LIMIT 8`, [userId]);
    const [tasks] = await pool.query("SELECT * FROM tasks WHERE created_by = ? AND status <> 'archived' ORDER BY created_at DESC LIMIT 8", [userId]);
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', [userId]);
    res.json({ success: true, profile, students, submissions, tasks, notifications, news: await getNews(), events: await getEvents() });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.coordinator = async (req, res) => {
  try {
    const [[students]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'");
    const [[mentors]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'mentor'");
    const [[tasks]] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE status = 'published'");
    const [[events]] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE status = 'published' AND event_date >= CURDATE()");
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', [req.user.user_id]);
    const [recentStudents] = await pool.query("SELECT u.id, u.name, u.email, sp.branch, sp.created_at FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE u.role = 'student' ORDER BY u.created_at DESC LIMIT 6");
    const [allNews] = await pool.query('SELECT id, title, content, category, status, created_at FROM news ORDER BY created_at DESC LIMIT 20');
    res.json({ success: true, stats: { students: students.count, mentors: mentors.count, tasks: tasks.count, events: events.count }, recentStudents, notifications, news: allNews, events: await getEvents() });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
