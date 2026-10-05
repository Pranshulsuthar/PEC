const pool = require('../config/db');
const bcrypt = require('bcryptjs');

function validEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

async function createAccountId(connection, prefix) {
  await connection.query('INSERT IGNORE INTO account_id_counters (prefix, next_value) VALUES (?, 100)', [prefix]);
  const [[counter]] = await connection.query('SELECT next_value FROM account_id_counters WHERE prefix = ? FOR UPDATE', [prefix]);
  const value = Number(counter.next_value);
  await connection.query('UPDATE account_id_counters SET next_value = ? WHERE prefix = ?', [value + 1, prefix]);
  return prefix + '_' + value;
}

exports.createAccount = async (req, res) => {
  if (req.body.role === 'coordinator' && req.user && req.user.role === 'coordinator') return exports.createCoordinator(req, res);
  if (['student', 'mentor'].includes(req.body.role)) return res.status(403).json({ success: false, message: 'Students and mentors must use public registration.' });
  return res.status(400).json({ success: false, message: 'Select a valid account role' });
};

exports.createStudent = async (req, res) => {
  const { name, email, password, college_id, enrollment_no, branch, year, section, linkedin_profile, github_profile, leetcode_profile } = req.body;
  if (!name || String(name).trim().length > 160 || !validEmail(email) || typeof password !== 'string' || password.length < 8 || !college_id || !enrollment_no || !branch || !year || !section) return res.status(400).json({ success: false, message: 'Name, valid email, password, College ID, branch, year, and section are required' });
  if (!['IT', 'CS', 'AI', 'DS'].includes(branch)) return res.status(400).json({ success: false, message: 'Select a valid branch' });
  if (!Number.isInteger(Number(year)) || Number(year) < 1 || Number(year) > 8 || String(section).trim().length > 50 || String(college_id).trim().length > 80 || String(enrollment_no).trim().length > 80) return res.status(400).json({ success: false, message: 'Invalid year, section, College ID, or enrollment number' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[duplicate]] = await connection.query('SELECT u.id FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN mentor_profiles mp ON mp.user_id = u.id LEFT JOIN coordinator_profiles cp ON cp.user_id = u.id WHERE u.email = ? OR sp.college_id = ? OR sp.enrollment_no = ? OR mp.college_id = ? OR cp.college_id = ? LIMIT 1 FOR UPDATE', [String(email).trim().toLowerCase(), String(college_id).trim(), String(enrollment_no).trim(), String(college_id).trim(), String(college_id).trim()]);
    if (duplicate) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Email, College ID, or enrollment number already exists' }); }
    const pecId = await createAccountId(connection, 'PEC');
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await connection.query("INSERT INTO users (name,email,password,role,is_active) VALUES (?,?,?,'student',1)", [String(name).trim(), String(email).trim().toLowerCase(), passwordHash]);
    await connection.query('INSERT INTO student_profiles (user_id,student_code,email,college_id,enrollment_no,roll_number,branch,year,section,linkedin_profile,github_profile,leetcode_profile) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [user.insertId, pecId, String(email).trim().toLowerCase(), String(college_id).trim(), String(enrollment_no).trim(), String(enrollment_no).trim(), branch, Number(year), String(section).trim(), linkedin_profile || null, github_profile || null, leetcode_profile || null]);
    await connection.query('UPDATE account_id_counters SET next_value = GREATEST(next_value, ?) WHERE prefix = ?', [Number(String(pecId).split('_')[1]) + 1, 'PEC']);
    await connection.commit();
    res.status(201).json({ success: true, message: 'Account created successfully', pec_id: pecId, student_id: user.insertId });
  } catch (error) { try { await connection.rollback(); } catch (rollbackError) { console.error(rollbackError); } if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email, College ID, or PEC ID already exists' }); console.error(error); res.status(500).json({ success: false, message: 'Unable to create student' }); }
  finally { connection.release(); }
};

exports.createCoordinator = async (req, res) => {
  const { name, email, password, college_id, branch, year, section } = req.body;
  if (!name || String(name).trim().length > 160 || !validEmail(email) || typeof password !== 'string' || password.length < 8 || !college_id || !branch || !year || !section) return res.status(400).json({ success: false, message: 'Name, valid email, password, College ID, branch, year, and section are required' });
  if (!['IT', 'CS', 'AI', 'DS'].includes(branch) || !Number.isInteger(Number(year)) || Number(year) < 1 || Number(year) > 8 || String(section).trim().length > 50 || String(college_id).trim().length > 80) return res.status(400).json({ success: false, message: 'Invalid branch, year, section, or College ID' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[duplicate]] = await connection.query('SELECT u.id FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN mentor_profiles mp ON mp.user_id = u.id LEFT JOIN coordinator_profiles cp ON cp.user_id = u.id WHERE u.email = ? OR sp.college_id = ? OR mp.college_id = ? OR cp.college_id = ? LIMIT 1 FOR UPDATE', [String(email).trim().toLowerCase(), String(college_id).trim(), String(college_id).trim(), String(college_id).trim()]);
    if (duplicate) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Email or College ID already exists' }); }
    const pecId = await createAccountId(connection, 'PEC');
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await connection.query("INSERT INTO users (name,email,password,role,is_active) VALUES (?,?,?,'coordinator',1)", [String(name).trim(), String(email).trim().toLowerCase(), passwordHash]);
    await connection.query('INSERT INTO coordinator_profiles (user_id,coordinator_code,email,employee_id,college_id,branch,year,section) VALUES (?,?,?,?,?,?,?,?)', [user.insertId, pecId, String(email).trim().toLowerCase(), pecId, String(college_id).trim(), branch, Number(year), String(section).trim()]);
    await connection.query('UPDATE account_id_counters SET next_value = GREATEST(next_value, ?) WHERE prefix = ?', [Number(String(pecId).split('_')[1]) + 1, 'PEC']);
    await connection.commit();
    res.status(201).json({ success: true, message: 'Account created successfully', pec_id: pecId, coordinator_id: user.insertId });
  } catch (error) { try { await connection.rollback(); } catch (rollbackError) { console.error(rollbackError); } if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email, College ID, or PEC ID already exists' }); console.error(error); res.status(500).json({ success: false, message: 'Unable to create coordinator' }); }
  finally { connection.release(); }
};

exports.createMentor = async (req, res) => {
  const { name, email, password, college_id, branch, year, section } = req.body;
  if (!name || String(name).trim().length > 160 || !validEmail(email) || typeof password !== 'string' || password.length < 8 || !college_id || !branch || !year || !section) return res.status(400).json({ success: false, message: 'Name, valid email, password, College ID, branch, year, and section are required' });
  if (!['IT', 'CS', 'AI', 'DS'].includes(branch) || !Number.isInteger(Number(year)) || Number(year) < 1 || Number(year) > 8 || String(section).trim().length > 50 || String(college_id).trim().length > 80) return res.status(400).json({ success: false, message: 'Invalid branch, year, section, or College ID' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[duplicate]] = await connection.query('SELECT u.id FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN mentor_profiles mp ON mp.user_id = u.id LEFT JOIN coordinator_profiles cp ON cp.user_id = u.id WHERE u.email = ? OR sp.college_id = ? OR mp.college_id = ? OR cp.college_id = ? LIMIT 1 FOR UPDATE', [String(email).trim().toLowerCase(), String(college_id).trim(), String(college_id).trim(), String(college_id).trim()]);
    if (duplicate) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Email or College ID already exists' }); }
    const pecId = await createAccountId(connection, 'PEC');
    const [[number]] = await connection.query('SELECT COALESCE(MAX(mentor_number),0)+1 AS next_number FROM mentor_profiles');
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await connection.query("INSERT INTO users (name,email,password,role,is_active) VALUES (?,?,?,'mentor',1)", [String(name).trim(), String(email).trim().toLowerCase(), passwordHash]);
    await connection.query('INSERT INTO mentor_profiles (user_id,mentor_code,email,mentor_number,college_id,branch,year,section) VALUES (?,?,?,?,?,?,?,?)', [user.insertId, pecId, String(email).trim().toLowerCase(), number.next_number, String(college_id).trim(), branch, Number(year), String(section).trim()]);
    await connection.query('UPDATE account_id_counters SET next_value = GREATEST(next_value, ?) WHERE prefix = ?', [Number(String(pecId).split('_')[1]) + 1, 'PEC']);
    await connection.commit();
    res.status(201).json({ success: true, message: 'Account created successfully', pec_id: pecId, mentor_id: user.insertId });
  } catch (error) { try { await connection.rollback(); } catch (rollbackError) { console.error(rollbackError); } if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email, College ID, or PEC ID already exists' }); console.error(error); res.status(500).json({ success: false, message: 'Unable to create mentor' }); }
  finally { connection.release(); }
};

exports.updateStudent = async (req, res) => {
  const { name, email, branch, year, skills, enrollment_no } = req.body;
  if (email && !validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  if (name && String(name).trim().length > 160) return res.status(400).json({ success: false, message: 'Name is too long' });
  try {
    const [result] = await pool.query("UPDATE users u JOIN student_profiles sp ON sp.user_id = u.id SET u.name = COALESCE(?,u.name),u.email = COALESCE(?,u.email),sp.branch = COALESCE(?,sp.branch),sp.year = COALESCE(?,sp.year),sp.skills = COALESCE(?,sp.skills),sp.roll_number = COALESCE(?,sp.roll_number) WHERE u.id = ? AND u.role = 'student'", [name || null,email || null,branch || null,year || null,skills || null,enrollment_no || null,req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true });
  } catch (error) { if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email or enrollment number already exists' }); console.error(error); res.status(500).json({ success: false, message: 'Unable to update student' }); }
};

exports.updateMentor = async (req, res) => {
  const { name, email, department, designation, group_id, group_name, expertise, bio } = req.body;
  if (email && !validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  if (name && String(name).trim().length > 160) return res.status(400).json({ success: false, message: 'Name is too long' });
  try {
    const [result] = await pool.query("UPDATE users u JOIN mentor_profiles mp ON mp.user_id = u.id SET u.name = COALESCE(?,u.name),u.email = COALESCE(?,u.email),mp.department = COALESCE(?,mp.department),mp.designation = COALESCE(?,mp.designation),mp.group_id = COALESCE(?,mp.group_id),mp.group_name = COALESCE(?,mp.group_name),mp.specialization = COALESCE(?,mp.specialization),mp.bio = COALESCE(?,mp.bio) WHERE u.id = ? AND u.role = 'mentor'", [name || null,email || null,department || null,designation || null,group_id || null,group_name || null,expertise || null,bio || null,req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Mentor not found' });
    res.json({ success: true });
  } catch (error) { if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email or Group ID already exists' }); console.error(error); res.status(500).json({ success: false, message: 'Unable to update mentor' }); }
};

exports.updateStudentStatus = async (req, res) => {
  const isActive = req.body.is_active === true || req.body.is_active === 1;
  try {
    const [result] = await pool.query("UPDATE users SET is_active = ? WHERE id = ? AND role = 'student'", [isActive ? 1 : 0, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Unable to update student status' }); }
};

exports.updateMentorStatus = async (req, res) => {
  const isActive = req.body.is_active === true || req.body.is_active === 1;
  try {
    const [result] = await pool.query("UPDATE users SET is_active = ? WHERE id = ? AND role = 'mentor'", [isActive ? 1 : 0, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Mentor not found' });
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Unable to update mentor status' }); }
};

exports.getAllStudents = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [rows] = await pool.query(`
       SELECT u.id AS student_id, sp.student_code, u.name, u.email, sp.roll_number, sp.branch, sp.year, sp.skills,
              assignment.id AS assignment_id, assignment.mentor_id, mp.mentor_code, mentor.name AS mentor_name
      FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
      LEFT JOIN mentor_student assignment ON assignment.id = (
        SELECT ms.id FROM mentor_student ms JOIN users assigned_mentor ON assigned_mentor.id = ms.mentor_id AND assigned_mentor.role = 'mentor'
        WHERE ms.student_id = u.id AND ms.status = 'active' ORDER BY ms.assigned_at DESC, ms.id DESC LIMIT 1
      )
       LEFT JOIN users mentor ON mentor.id = assignment.mentor_id AND mentor.role = 'mentor'
       LEFT JOIN mentor_profiles mp ON mp.user_id = mentor.id
       WHERE u.role = 'student' ORDER BY u.name
     `);
    res.json({ success: true, students: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getAllMentors = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [rows] = await pool.query(`
       SELECT u.id AS mentor_id, mp.mentor_code, u.name, u.email, mp.specialization, mp.department, mp.group_id, mp.group_name,
              mp.designation, COUNT(DISTINCT student.id) AS assigned_students
      FROM users u JOIN mentor_profiles mp ON mp.user_id = u.id
      LEFT JOIN mentor_student ms ON ms.mentor_id = u.id AND ms.status = 'active'
      LEFT JOIN users student ON student.id = ms.student_id AND student.role = 'student'
      WHERE u.role = 'mentor' GROUP BY u.id, u.name, u.email, mp.mentor_code, mp.specialization, mp.department, mp.group_id, mp.group_name, mp.designation
      ORDER BY u.name
    `);
    res.json({ success: true, mentors: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getEvents = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [events] = await pool.query('SELECT e.*, \'Event\' AS category FROM events e ORDER BY e.event_date ASC, e.start_time ASC');
    res.json({ success: true, events });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getSubmissions = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [rows] = await pool.query(`SELECT ts.id, ts.task_id, ts.student_id, ts.submission_text, ts.submission_url, ts.submitted_at, ts.status, ts.score, ts.feedback, t.title, t.description AS challenge_description, t.max_score, u.name AS student_name, sp.student_code, mu.name AS mentor_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id AND u.role = 'student' LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active' LEFT JOIN users mu ON mu.id = ms.mentor_id AND mu.role = 'mentor' ORDER BY ts.submitted_at DESC`);
    res.json({ success: true, submissions: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getLeaderboard = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [rows] = await pool.query(`SELECT u.id AS student_id, u.name AS student_name, sp.student_code, mentor.name AS mentor_name, COUNT(DISTINCT CASE WHEN ts.status = 'accepted' THEN ts.task_id END) AS challenges_completed, COALESCE(SUM(CASE WHEN ts.status = 'accepted' THEN ts.score ELSE 0 END), 0) AS points FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN task_submissions ts ON ts.student_id = u.id LEFT JOIN mentor_student ms ON ms.student_id = u.id AND ms.status = 'active' LEFT JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE u.role = 'student' GROUP BY u.id, u.name, sp.student_code, mentor.name HAVING challenges_completed > 0 OR points > 0 ORDER BY points DESC, challenges_completed DESC, u.name`);
    res.json({ success: true, leaderboard: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getResources = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [rows] = await pool.query(`SELECT id, title, description, resource_type, resource_url, category, status, created_at FROM resources ORDER BY created_at DESC`);
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
    const [result] = await pool.query('DELETE FROM resources WHERE id = ?', [req.params.id]);
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
      const [[mentor]] = await connection.query("SELECT id FROM users WHERE id = ? AND role = 'mentor' FOR UPDATE", [mentorId]);
      const [[student]] = await connection.query("SELECT id FROM users WHERE id = ? AND role = 'student' FOR UPDATE", [studentId]);
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
      if (Number(capacity.count) >= 7) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Mentor capacity reached. Maximum 7 mentees are allowed.' });
      }
      const [[activeAssignment]] = await connection.query("SELECT ms.id, ms.mentor_id FROM mentor_student ms JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.student_id = ? AND ms.status = 'active' LIMIT 1 FOR UPDATE", [studentId]);
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
      const taskStatus = status || 'published';
      const [result] = await connection.query(
        'INSERT INTO tasks (title, description, difficulty, category, deadline, max_score, status, created_by) VALUES (?,?,?,?,?,?,?,?)',
        [String(title).trim(), [description, instructions, resources ? 'Resources: ' + resources : ''].filter(Boolean).join('\n\n') || null, difficulty, category || null, deadline || null, points, taskStatus, req.user.user_id]
      );
      if (taskStatus === 'published') {
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student'");
        await connection.query(`INSERT INTO task_assignments (task_id, student_id, assigned_by, deadline) SELECT ?, u.id, ?, ? FROM users u WHERE u.role = 'student'`, [result.insertId, req.user.user_id, deadline || null]);
        for (const student of students) await connection.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [student.id, 'New challenge available', String(title).trim(), 'challenge']);
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
    const [[existing]] = await pool.query('SELECT id, status FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Challenge not found' });
    const [result] = await pool.query('UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description), difficulty = COALESCE(?, difficulty), category = COALESCE(?, category), deadline = COALESCE(?, deadline), status = COALESCE(?, status) WHERE id = ?', [title ? String(title).trim() : null, description === undefined ? null : description, difficulty || null, category === undefined ? null : category, deadline || null, status || null, req.params.id]);
    if (status === 'published' && existing.status !== 'published') {
      const [students] = await pool.query("SELECT u.id FROM users u WHERE u.role = 'student' AND NOT EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = ? AND ta.student_id = u.id)", [req.params.id]);
      await pool.query("INSERT INTO task_assignments (task_id, student_id, assigned_by, deadline) SELECT ?, u.id, ?, COALESCE(?, t.deadline) FROM users u JOIN tasks t ON t.id = ? WHERE u.role = 'student' AND NOT EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.student_id = u.id)", [req.params.id, req.user.user_id, deadline || null, req.params.id]);
      for (const student of students) await pool.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [student.id, 'New challenge available', title || existing.title || 'A challenge was published', 'challenge']);
    }
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
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [news] = await pool.query('SELECT * FROM news ORDER BY created_at DESC');
    res.json({ success: true, news });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getDashboard = async (req, res) => {
  try {
    if (req.user.role !== 'coordinator') return res.status(403).json({ success: false, message: 'Coordinator access required' });
    const [[students]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'");
    const [[mentors]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'mentor'");
    const [[tasks]] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE status <> 'archived'");
    const [[events]] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE event_date >= CURDATE() AND status = 'published'");
    const [[assigned]] = await pool.query("SELECT COUNT(DISTINCT ms.student_id) AS count FROM mentor_student ms JOIN users student ON student.id = ms.student_id AND student.role = 'student' JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.status = 'active'");
    const [[unassigned]] = await pool.query("SELECT COUNT(*) AS count FROM users u WHERE u.role = 'student' AND NOT EXISTS (SELECT 1 FROM mentor_student ms JOIN users mentor ON mentor.id = ms.mentor_id AND mentor.role = 'mentor' WHERE ms.student_id = u.id AND ms.status = 'active')");
    const [[submissions]] = await pool.query('SELECT COUNT(*) AS count FROM task_submissions');
    const [[pendingSubmissions]] = await pool.query("SELECT COUNT(*) AS count FROM task_submissions WHERE status = 'submitted'");
    const [[newsCount]] = await pool.query("SELECT COUNT(*) AS count FROM news WHERE status = 'published'");
    const [[resourcesCount]] = await pool.query("SELECT COUNT(*) AS count FROM resources WHERE status <> 'archived'");
    const [[publishedEvents]] = await pool.query("SELECT COUNT(*) AS count FROM events WHERE status = 'published' AND event_date >= CURDATE()");
    const [recentStudents] = await pool.query("SELECT u.id, u.name, u.email, sp.student_code, sp.branch, sp.year, u.created_at FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.role = 'student' ORDER BY u.created_at DESC LIMIT 6");
    const [recentSubmissions] = await pool.query("SELECT ts.id, ts.status, ts.submitted_at, ts.score, t.title, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id ORDER BY ts.submitted_at DESC LIMIT 5");
    const [upcomingEvents] = await pool.query("SELECT * FROM events WHERE status = 'published' AND event_date >= CURDATE() ORDER BY event_date ASC LIMIT 5");
    res.json({ success: true, stats: { students: Number(students.count), mentors: Number(mentors.count), assignedMentees: Number(assigned.count), unassignedStudents: Number(unassigned.count), tasks: Number(tasks.count), submissions: Number(submissions.count), pendingSubmissions: Number(pendingSubmissions.count), events: Number(publishedEvents.count), upcomingEvents: Number(events.count), news: Number(newsCount.count), resources: Number(resourcesCount.count) }, recentStudents, recentSubmissions, upcomingEvents });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
