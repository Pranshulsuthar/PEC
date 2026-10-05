const pool = require('../config/db');

exports.create = async (req, res) => {
  const { task_id, submission_url, code } = req.body;
  if (!Number.isInteger(Number(task_id)) || Number(task_id) < 1 || (!submission_url && !code)) return res.status(400).json({ success: false, message: 'Task and submission are required' });
  if (submission_url && (!/^https?:\/\//i.test(submission_url) || submission_url.length > 500)) return res.status(400).json({ success: false, message: 'Submission URL must be a valid HTTP(S) link' });
  if (code && String(code).length > 200000) return res.status(413).json({ success: false, message: 'Submission is too large' });
  try {
    const [[task]] = await pool.query("SELECT t.id, t.deadline, t.created_by FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id AND ta.student_id = ? AND ta.status <> 'completed' WHERE t.id = ? AND t.status = 'published'", [req.user.user_id, task_id]);
    if (!task) return res.status(403).json({ success: false, message: 'This challenge is not assigned to you' });
    const isLate = task.deadline && new Date(task.deadline) < new Date();
    const connection = await pool.getConnection();
    let submissionId;
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query('SELECT id FROM task_submissions WHERE task_id = ? AND student_id = ? FOR UPDATE', [task_id, req.user.user_id]);
      if (existing.length) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'You already submitted this task' });
      }
      const [result] = await connection.query('INSERT INTO task_submissions (task_id, student_id, submission_text, submission_url, status) VALUES (?,?,?,?,?)', [task_id, req.user.user_id, code || null, submission_url || null, isLate ? 'late' : 'submitted']);
      submissionId = result.insertId;
      await connection.query("UPDATE task_assignments SET status = 'submitted' WHERE task_id = ? AND student_id = ?", [task_id, req.user.user_id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'You already submitted this task' });
      throw error;
    } finally { connection.release(); }
    const [[taskOwner]] = await pool.query('SELECT role FROM users WHERE id = ?', [task.created_by]);
    let notificationTargets = [];
    if (taskOwner && taskOwner.role === 'mentor') notificationTargets = [task.created_by];
    else if (taskOwner && taskOwner.role === 'coordinator') {
      const [coordinators] = await pool.query("SELECT id FROM users WHERE role = 'coordinator'");
      notificationTargets = coordinators.map(function (user) { return user.id; });
    }
    for (const recipientId of notificationTargets) await pool.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [recipientId, 'New challenge submission', 'A student submitted work for a challenge.', 'submission']);
    res.status(201).json({ success: true, submission_id: submissionId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'You already submitted this task' });
    console.error(err); res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAll = async (req, res) => {
  try {
    let sql = `SELECT ts.*, t.title, t.max_score, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id`;
    const params = [];
    if (req.user.role === 'student') {
      sql += ' WHERE ts.student_id = ?';
      params.push(req.user.user_id);
    } else if (req.user.role === 'mentor') {
      sql += ` JOIN mentor_student ms ON ms.student_id = ts.student_id AND ms.mentor_id = ? AND ms.status = 'active'`;
      params.push(req.user.user_id);
    } else if (req.user.role !== 'coordinator') {
      return res.status(403).json({ success: false, message: 'Role not permitted' });
    }
    sql += ' ORDER BY ts.submitted_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, submissions: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT ts.*, t.title, t.max_score, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id WHERE ts.id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submission not found' });
    const submission = rows[0];
    if (!['student', 'mentor', 'coordinator'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Role not permitted' });
    if (req.user.role === 'student' && Number(submission.student_id) !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.role === 'mentor') {
      const [assigned] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [req.user.user_id, submission.student_id]);
      if (!assigned.length) return res.status(403).json({ success: false, message: 'Forbidden' });
    } else if (req.user.role !== 'coordinator' && req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Role not permitted' });
    }
    if (req.user.role === 'coordinator') {
      const [rows] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'coordinator'", [req.user.user_id]);
      if (!rows.length) return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.json({ success: true, submission });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.update = async (req, res) => {
  const { feedback, score, status } = req.body;
  const allowedStatuses = ['reviewed', 'accepted', 'rejected'];
  const numericScore = score === '' || score === null || score === undefined ? null : Number(score);
  if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0)) return res.status(400).json({ success: false, message: 'Score must be a non-negative number' });
  if (status && !allowedStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid review status' });
  try {
    const [rows] = await pool.query('SELECT ts.student_id, ts.task_id, ts.status AS submission_status, ms.mentor_id FROM task_submissions ts LEFT JOIN mentor_student ms ON ms.student_id = ts.student_id AND ms.status = \'active\' WHERE ts.id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (req.user.role === 'mentor') {
      const [assigned] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [req.user.user_id, rows[0].student_id]);
      if (!assigned.length) return res.status(403).json({ success: false, message: 'Forbidden' });
    } else if (req.user.role !== 'coordinator') {
      return res.status(403).json({ success: false, message: 'Role not permitted' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE task_submissions SET feedback = ?, score = ?, status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [feedback || null, numericScore, status || 'reviewed', req.user.user_id, req.params.id]);
      await connection.query('UPDATE task_assignments SET status = ? WHERE task_id = ? AND student_id = ?', [status === 'accepted' ? 'completed' : 'assigned', rows[0].task_id, rows[0].student_id]);
      await connection.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [rows[0].student_id, 'Submission reviewed', feedback || 'Your submission has been reviewed.', 'submission']);
      await connection.commit();
      res.json({ success: true, message: 'Submission reviewed' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.delete = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT student_id, status FROM task_submissions WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (Number(rows[0].student_id) !== Number(req.user.user_id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (rows[0].status !== 'submitted') return res.status(400).json({ success: false, message: 'Cannot delete after review' });
    await pool.query('DELETE FROM task_submissions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Submission deleted' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
