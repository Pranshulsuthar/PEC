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
    if (req.user.role !== 'student') return res.status(403).json({ success: false, message: 'Student access required' });
    const [[profile]] = await pool.query(`SELECT u.id AS user_id, u.name, u.email, u.created_at AS joined_at, sp.* FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = ? AND u.role = 'student'`, [userId]);
    if (!profile) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const [mentor] = await pool.query(`SELECT u.id, u.name, u.email, mp.mentor_code, mp.group_id, mp.group_name, mp.specialization, mp.department, mp.designation FROM mentor_student ms JOIN users u ON u.id = ms.mentor_id AND u.role = 'mentor' LEFT JOIN mentor_profiles mp ON mp.user_id = u.id WHERE ms.student_id = ? AND ms.status = 'active' LIMIT 1`, [userId]);
    const [tasks] = await pool.query(`SELECT t.id, t.title, t.description, t.difficulty, t.deadline, ta.status AS assignment_status FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id JOIN mentor_student ms ON ms.student_id = ta.student_id AND ms.status = 'active' WHERE ta.student_id = ? ORDER BY ta.deadline ASC LIMIT 8`, [userId]);
    const [[completed]] = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(score), 0) AS points FROM task_submissions WHERE student_id = ? AND status = 'accepted'", [userId]);
    const [[assigned]] = await pool.query('SELECT COUNT(*) AS count FROM task_assignments WHERE student_id = ?', [userId]);
    const [[rank]] = await pool.query("SELECT COUNT(*) + 1 AS rank FROM (SELECT u.id, COALESCE(SUM(ts.score), 0) AS points FROM users u LEFT JOIN task_submissions ts ON ts.student_id = u.id AND ts.status = 'accepted' WHERE u.role = 'student' GROUP BY u.id) ranked WHERE points > ?", [completed.points]);
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', [userId]);
    res.json({ success: true, profile, mentor: mentor[0] || null, tasks, progress: { total_tasks: assigned.count, completed_tasks: completed.count, current_streak: 0, rank: assigned.count ? Number(rank.rank) : null, points: Number(completed.points), progress_percentage: assigned.count ? Math.round((completed.count / assigned.count) * 100) : 0 }, skills: [], achievements: [], resources: [], attendance: [], notifications, news: [], events: [] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.mentor = async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (req.user.role !== 'mentor') return res.status(403).json({ success: false, message: 'Mentor access required' });
    const [[profile]] = await pool.query(`SELECT u.name, u.email, mp.* FROM users u LEFT JOIN mentor_profiles mp ON mp.user_id = u.id WHERE u.id = ? AND u.role = 'mentor'`, [userId]);
    if (!profile) return res.status(404).json({ success: false, message: 'Mentor profile not found' });
    const [students] = await pool.query(`SELECT u.id, u.name, u.email, sp.student_code, sp.roll_number AS enrollment_no, sp.branch, sp.year, sp.skills, mp.group_id, mp.group_name FROM mentor_student ms JOIN users u ON u.id = ms.student_id AND u.role = 'student' LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN mentor_profiles mp ON mp.user_id = ms.mentor_id WHERE ms.mentor_id = ? AND ms.status = 'active' ORDER BY u.name`, [userId]);
    const [submissions] = await pool.query(`SELECT ts.id, ts.status, ts.score, ts.submitted_at, t.title, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN mentor_student ms ON ms.student_id = ts.student_id AND ms.mentor_id = ? AND ms.status = 'active' JOIN users u ON u.id = ts.student_id ORDER BY ts.submitted_at DESC LIMIT 8`, [userId]);
    const [tasks] = await pool.query("SELECT * FROM tasks WHERE created_by = ? AND status <> 'archived' ORDER BY created_at DESC LIMIT 8", [userId]);
    const [[meetings]] = await pool.query('SELECT 0 AS count');
    const [[pendingReviews]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions ts JOIN mentor_student ms ON ms.student_id = ts.student_id AND ms.mentor_id = ? AND ms.status = 'active' WHERE ts.status = 'submitted'", [userId]);
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', [userId]);
    res.json({ success: true, profile, students, capacity: { assigned: students.length, maximum: 4, available: Math.max(0, 4 - students.length), full: students.length >= 4 }, submissions, pendingReviews: pendingReviews.count, meetings: meetings.count, tasks, notifications, news: [], events: [] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.coordinator = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [[students]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'");
    const [[mentors]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'mentor'");
    const [[tasks]] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE status = 'published'");
    const [[solved]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions WHERE status = 'accepted'");
    const [[activeStudents]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'");
    const [[assigned]] = await pool.query("SELECT COUNT(DISTINCT student_id) AS count FROM mentor_student WHERE status = 'active'");
    const [[unassigned]] = await pool.query("SELECT COUNT(*) AS count FROM users u LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active' WHERE u.role = 'student' AND ms.id IS NULL");
    const [events] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE status = 'published' AND event_date >= CURDATE()");
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', [req.user.user_id]);
    const [recentStudents] = await pool.query("SELECT u.id, u.name, u.email, sp.branch, sp.created_at FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.role = 'student' ORDER BY u.created_at DESC LIMIT 6");
    const [allNews] = await pool.query('SELECT id, title, content, category, status, created_at FROM news ORDER BY created_at DESC LIMIT 20');
    res.json({ success: true, stats: { students: Number(students.count), activeStudents: Number(activeStudents.count), mentors: Number(mentors.count), assignedMentees: Number(assigned.count), unassignedStudents: Number(unassigned.count), tasks: Number(tasks.count), solved: Number(solved.count), events: Number(events.count) }, recentStudents, notifications, news: allNews, events: await getEvents() });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
