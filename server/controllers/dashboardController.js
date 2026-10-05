const pool = require('../config/db');

async function getNews(userId) {
  const [rows] = await pool.query("SELECT n.id, n.title, n.content, n.category, n.created_at, n.published_at, (nr.user_id IS NOT NULL) AS is_read FROM news n LEFT JOIN news_reads nr ON nr.news_id = n.id AND nr.user_id = ? WHERE n.status = 'published' ORDER BY n.created_at DESC LIMIT 100", [userId]);
  return rows;
}

async function getEvents() {
  const [rows] = await pool.query("SELECT e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.location FROM events e WHERE e.status = 'published' AND e.event_date >= CURDATE() ORDER BY e.event_date ASC LIMIT 100");
  return rows;
}

async function getStudentEvents(userId) {
  const [rows] = await pool.query("SELECT e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.location, er.registration_status FROM events e LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = ? AND er.registration_status = 'registered' WHERE e.status = 'published' AND e.event_date >= CURDATE() ORDER BY e.event_date ASC LIMIT 50", [userId]);
  return rows;
}

exports.student = async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (req.user.role !== 'student') return res.status(403).json({ success: false, message: 'Student access required' });
    const [[profile]] = await pool.query(`SELECT u.id AS user_id, u.name, u.email, u.created_at AS joined_at, sp.* FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = ? AND u.role = 'student'`, [userId]);
    if (!profile) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const [mentor] = await pool.query(`SELECT u.id, u.name, u.email, mp.mentor_code, mp.group_id, mp.group_name, mp.specialization, mp.department, mp.designation FROM mentor_student ms JOIN users u ON u.id = ms.mentor_id AND u.role = 'mentor' LEFT JOIN mentor_profiles mp ON mp.user_id = u.id WHERE ms.student_id = ? AND ms.status = 'active' LIMIT 1`, [userId]);
    const [tasks] = await pool.query(`SELECT t.id, t.title, t.description, t.difficulty, t.deadline, t.max_score, ta.status AS assignment_status FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id WHERE ta.student_id = ? AND ta.status = 'assigned' AND t.status = 'published' ORDER BY ta.deadline ASC LIMIT 50`, [userId]);
    const [[completed]] = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(score), 0) AS points FROM task_submissions WHERE student_id = ? AND status = 'accepted'", [userId]);
    const [[assigned]] = await pool.query("SELECT COUNT(*) AS count FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id WHERE ta.student_id = ? AND t.status = 'published'", [userId]);
    const [submissions] = await pool.query("SELECT ts.*, t.title, t.max_score FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id WHERE ts.student_id = ? ORDER BY ts.submitted_at DESC", [userId]);
    const [courses] = await pool.query("SELECT r.id, r.title, r.description, r.resource_type, r.resource_url, r.category FROM resources r WHERE r.status = 'published' ORDER BY r.created_at DESC");
    const [[rank]] = await pool.query("SELECT COUNT(*) + 1 AS rank FROM (SELECT u.id, COALESCE(SUM(ts.score), 0) AS points FROM users u LEFT JOIN task_submissions ts ON ts.student_id = u.id AND ts.status = 'accepted' WHERE u.role = 'student' GROUP BY u.id) ranked WHERE points > ?", [completed.points]);
    const [leaderboard] = await pool.query("SELECT u.id, u.name, COALESCE(lb.points, SUM(ts.score),0) AS points, COALESCE(lb.challenges_completed, COUNT(DISTINCT CASE WHEN ts.status = 'accepted' THEN ts.task_id END),0) AS completed_challenges FROM users u LEFT JOIN leaderboard lb ON lb.student_id = u.id LEFT JOIN task_submissions ts ON ts.student_id = u.id AND ts.status = 'accepted' WHERE u.role = 'student' GROUP BY u.id,u.name,lb.points,lb.challenges_completed HAVING points > 0 OR completed_challenges > 0 ORDER BY points DESC,completed_challenges DESC,u.name LIMIT 100");
    const [activity] = await pool.query("SELECT DATE(submitted_at) AS activity_date, COUNT(*) AS submissions FROM task_submissions WHERE student_id = ? AND status = 'accepted' AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(submitted_at) ORDER BY activity_date", [userId]);
    const [[streak]] = await pool.query("SELECT COUNT(*) AS days FROM (SELECT DISTINCT DATE(submitted_at) AS submission_date FROM task_submissions WHERE student_id = ? AND status = 'accepted' ORDER BY submission_date DESC LIMIT 30) streak_days", [userId]);
    const [[attendanceSummary]] = await pool.query("SELECT COUNT(*) AS total, SUM(status = 'present') AS present FROM attendance WHERE student_id = ?", [userId]);
    const [skills] = await pool.query('SELECT s.name, ss.proficiency_level FROM student_skills ss JOIN skills s ON s.id = ss.skill_id WHERE ss.student_id = ? ORDER BY s.name', [userId]);
    const [[profileExtras]] = await pool.query('SELECT bio FROM student_profiles WHERE user_id = ?', [userId]);
    profile.bio = profileExtras && profileExtras.bio || null;
    const [resources] = await pool.query("SELECT id, title, description, resource_type, resource_url, category, created_at FROM resources WHERE status = 'published' ORDER BY created_at DESC LIMIT 20");
    const [achievements] = await pool.query('SELECT id, title, description, achievement_type, certificate_url, `date` FROM achievements WHERE student_id = ? ORDER BY `date` DESC, created_at DESC', [userId]);
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [userId]);
    const news = await getNews(userId);
    const events = await getStudentEvents(userId);
    res.json({ success: true, profile, mentor: mentor[0] || null, tasks, submissions, courses, leaderboard, activity, progress: { total_tasks: assigned.count, completed_tasks: completed.count, current_streak: Number(streak.days || 0), rank: assigned.count ? Number(rank.rank) : null, points: Number(completed.points), progress_percentage: assigned.count ? Math.round((completed.count / assigned.count) * 100) : 0 }, skills, achievements: [], resources, achievements, attendance: { present: Number(attendanceSummary.present || 0), total: Number(attendanceSummary.total || 0) }, notifications, news, events });
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
    const [tasks] = await pool.query("SELECT t.*, COUNT(DISTINCT ts.id) AS submission_count FROM tasks t LEFT JOIN task_submissions ts ON ts.task_id = t.id WHERE t.status <> 'archived' AND (t.created_by = ? OR EXISTS (SELECT 1 FROM task_assignments ta JOIN mentor_student ms ON ms.student_id = ta.student_id AND ms.mentor_id = ? AND ms.status = 'active' WHERE ta.task_id = t.id)) GROUP BY t.id ORDER BY t.created_at DESC LIMIT 50", [userId, userId]);
    const [[meetings]] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE created_by = ? AND event_date >= CURDATE() AND status = 'published'", [userId]);
    const [[pendingReviews]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions ts JOIN mentor_student ms ON ms.student_id = ts.student_id AND ms.mentor_id = ? AND ms.status = 'active' WHERE ts.status IN ('submitted','late')", [userId]);
    const [[reportStats]] = await pool.query("SELECT COUNT(DISTINCT ta.task_id) AS assigned_tasks, COUNT(DISTINCT CASE WHEN ts.status = 'accepted' THEN ts.task_id END) AS completed_tasks, COALESCE(AVG(CASE WHEN ts.status = 'accepted' THEN ts.score END), 0) AS average_score FROM mentor_student ms JOIN task_assignments ta ON ta.student_id = ms.student_id LEFT JOIN task_submissions ts ON ts.student_id = ta.student_id AND ts.task_id = ta.task_id WHERE ms.mentor_id = ? AND ms.status = 'active'", [userId]);
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [userId]);
    const news = await getNews(userId);
    const events = await getStudentEvents(userId);
    const reportStudents = students.map(async (student) => {
      const [[stats]] = await pool.query("SELECT COUNT(DISTINCT ta.task_id) AS assigned_tasks, COUNT(DISTINCT CASE WHEN ts.status = 'accepted' THEN ts.task_id END) AS completed_tasks, COALESCE(AVG(CASE WHEN ts.status = 'accepted' THEN ts.score END), 0) AS average_score FROM task_assignments ta LEFT JOIN task_submissions ts ON ts.task_id = ta.task_id AND ts.student_id = ta.student_id WHERE ta.student_id = ?", [student.id]);
      return Object.assign({}, student, stats, { progress: stats.assigned_tasks ? Math.round(Number(stats.completed_tasks) / Number(stats.assigned_tasks) * 100) : 0 });
    });
    res.json({ success: true, profile, students: await Promise.all(reportStudents), capacity: { assigned: students.length, maximum: 7, available: Math.max(0, 7 - students.length), full: students.length >= 7 }, submissions, pendingReviews: Number(pendingReviews.count), meetings: Number(meetings.count), tasks, reportStats: { assignedTasks: Number(reportStats.assigned_tasks), completedTasks: Number(reportStats.completed_tasks), averageScore: Number(reportStats.average_score) }, notifications, news, events });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.coordinator = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [[students]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'");
    const [[mentors]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'mentor'");
    const [[tasks]] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE status = 'published'");
    const [[solved]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions WHERE status = 'accepted'");
    const [[activeStudents]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student' AND is_active = 1");
    const [[assigned]] = await pool.query("SELECT COUNT(DISTINCT ms.student_id) AS count FROM mentor_student ms JOIN users student ON student.id = ms.student_id AND student.role = 'student' JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.status = 'active'");
    const [[unassigned]] = await pool.query("SELECT COUNT(*) AS count FROM users u WHERE u.role = 'student' AND NOT EXISTS (SELECT 1 FROM mentor_student ms JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.student_id = u.id AND ms.status = 'active')");
    const [[submissions]] = await pool.query('SELECT COUNT(*) AS count FROM task_submissions');
    const [[pendingSubmissions]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions WHERE status = 'submitted'");
    const [events] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE status = 'published' AND event_date >= CURDATE()");
    const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.user_id]);
    const [recentStudents] = await pool.query("SELECT u.id, u.name, u.email, sp.branch, sp.created_at FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.role = 'student' ORDER BY u.created_at DESC LIMIT 6");
    const [allNews] = await pool.query('SELECT id, title, content, category, status, created_at FROM news ORDER BY created_at DESC LIMIT 20');
    const [recentSubmissions] = await pool.query("SELECT ts.id, ts.status, ts.submitted_at, ts.score, t.title, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id ORDER BY ts.submitted_at DESC LIMIT 5");
    res.json({ success: true, stats: { students: Number(students.count), activeStudents: Number(activeStudents.count), mentors: Number(mentors.count), assignedMentees: Number(assigned.count), unassignedStudents: Number(unassigned.count), tasks: Number(tasks.count), solved: Number(solved.count), submissions: Number(submissions.count), pendingSubmissions: Number(pendingSubmissions.count), events: Number(events.count) }, recentStudents, recentSubmissions, notifications, news: allNews, events: await getEvents() });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
