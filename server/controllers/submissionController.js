const pool = require('../config/db');

exports.create = async (req, res) => {
  const { task_id, submission_url, code } = req.body;
  if (!task_id || (!submission_url && !code)) return res.status(400).json({ success: false, message: 'Task and submission are required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO task_submissions (task_id, student_id, submission_text, submission_url) VALUES (?,?,?,?)',
      [task_id, req.user.user_id, code || null, submission_url || null]
    );
    res.status(201).json({ success: true, submission_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'You already submitted this task' });
    console.error(err); res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAll = async (req, res) => {
  try {
    let sql = `SELECT ts.*, t.title, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id`;
    const params = [];
    if (req.user.role === 'student') {
      sql += ' WHERE ts.student_id = ?';
      params.push(req.user.user_id);
    } else if (req.user.role === 'mentor') {
      sql += ` JOIN mentor_student ms ON ms.student_id = ts.student_id AND ms.mentor_id = ? AND ms.status = 'active'`;
      params.push(req.user.user_id);
    }
    sql += ' ORDER BY ts.submitted_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, submissions: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT ts.*, t.title, u.name AS student_name FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id JOIN users u ON u.id = ts.student_id WHERE ts.id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submission not found' });
    const submission = rows[0];
    if (req.user.role === 'student' && submission.student_id !== req.user.user_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.role === 'mentor') {
      const [assigned] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [req.user.user_id, submission.student_id]);
      if (!assigned.length) return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.json({ success: true, submission });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.update = async (req, res) => {
  const { feedback, score, status } = req.body;
  try {
    const [rows] = await pool.query('SELECT student_id FROM task_submissions WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submission not found' });
    const [assigned] = await pool.query("SELECT id FROM mentor_student WHERE mentor_id = ? AND student_id = ? AND status = 'active'", [req.user.user_id, rows[0].student_id]);
    if (!assigned.length) return res.status(403).json({ success: false, message: 'Forbidden' });
    await pool.query('UPDATE task_submissions SET feedback = ?, score = ?, status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [feedback || null, score || null, status || 'reviewed', req.user.user_id, req.params.id]);
    res.json({ success: true, message: 'Submission reviewed' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.delete = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT student_id, status FROM task_submissions WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (rows[0].student_id !== req.user.user_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (rows[0].status !== 'submitted') return res.status(400).json({ success: false, message: 'Cannot delete after review' });
    await pool.query('DELETE FROM task_submissions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Submission deleted' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};
