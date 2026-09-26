const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    let sql = "SELECT t.*, COUNT(DISTINCT ts.id) AS submission_count FROM tasks t LEFT JOIN task_submissions ts ON ts.task_id = t.id";
    const params = [];
    if (req.user.role === 'student') {
      sql += " JOIN task_assignments ta ON ta.task_id = t.id AND ta.student_id = ? AND ta.status = 'assigned' WHERE t.status = 'published' AND NOT EXISTS (SELECT 1 FROM task_submissions ts WHERE ts.task_id = t.id AND ts.student_id = ?)";
      params.push(req.user.user_id, req.user.user_id);
    } else if (req.user.role === 'mentor') {
      sql += " WHERE t.status = 'published' AND (t.created_by = ? OR EXISTS (SELECT 1 FROM task_assignments ta JOIN mentor_student ms ON ms.student_id = ta.student_id AND ms.mentor_id = ? AND ms.status = 'active' WHERE ta.task_id = t.id))";
      params.push(req.user.user_id, req.user.user_id);
    } else if (req.user.role === 'coordinator') {
      sql += " WHERE t.status <> 'archived'";
    } else {
      return res.status(403).json({ success: false, message: 'Role not permitted' });
    }
    sql += ' GROUP BY t.id ORDER BY t.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  const id = req.params.id;
  try {
    let sql = 'SELECT t.* FROM tasks t';
    const params = [];
    if (req.user.role === 'student') {
      sql += " JOIN task_assignments ta ON ta.task_id = t.id AND ta.student_id = ? AND ta.status = 'assigned' WHERE t.id = ? AND t.status = 'published'";
      params.push(req.user.user_id, id);
    } else if (req.user.role === 'mentor') {
      sql += " WHERE t.id = ? AND t.status = 'published' AND (t.created_by = ? OR EXISTS (SELECT 1 FROM task_assignments ta JOIN mentor_student ms ON ms.student_id = ta.student_id AND ms.mentor_id = ? AND ms.status = 'active' WHERE ta.task_id = t.id))";
      params.push(id, req.user.user_id, req.user.user_id);
    } else if (req.user.role === 'coordinator') {
      sql += ' WHERE t.id = ?';
      params.push(id);
    } else {
      return res.status(403).json({ success: false, message: 'Role not permitted' });
    }
    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, task: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { title, description, difficulty, category, deadline } = req.body;
  if (!title) return res.status(400).json({ success: false, message: 'Title required' });
  if (req.user.role === 'mentor') {
    const [[profile]] = await pool.query('SELECT id FROM mentor_profiles WHERE user_id = ?', [req.user.user_id]);
    if (!profile) return res.status(403).json({ success: false, message: 'Mentor profile required' });
  }
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'INSERT INTO tasks (title, description, difficulty, category, deadline, created_by, status) VALUES (?,?,?,?,?,?,?)',
        [title, description || null, difficulty || 'Easy', category || null, deadline || null, req.user.user_id, 'published']
      );
      let assignedCount = 0;
      if (req.user.role === 'mentor') {
        const [assigned] = await connection.query("INSERT INTO task_assignments (task_id, student_id, assigned_by, deadline) SELECT ?, student_id, ?, ? FROM mentor_student WHERE mentor_id = ? AND status = 'active'", [result.insertId, req.user.user_id, deadline || null, req.user.user_id]);
        assignedCount = assigned.affectedRows;
      }
      await connection.commit();
      res.status(201).json({ success: true, task_id: result.insertId, assigned_count: assignedCount });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'This task is already assigned to the student.' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const id = req.params.id;
  const { title, description, difficulty, category, deadline } = req.body;
  try {
    const isCoordinator = req.user.role === 'coordinator';
    const [result] = await pool.query(
      isCoordinator
        ? 'UPDATE tasks SET title = ?, description = ?, difficulty = ?, category = ?, deadline = ?, status = ? WHERE id = ?'
        : "UPDATE tasks SET title = ?, description = ?, difficulty = ?, category = ?, deadline = ?, status = ? WHERE id = ? AND created_by = ?",
      isCoordinator
        ? [title || null, description || null, difficulty || 'Easy', category || null, deadline || null, req.body.status || 'published', id]
        : [title || null, description || null, difficulty || 'Easy', category || null, deadline || null, req.body.status || 'published', id, req.user.user_id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  const id = req.params.id;
  try {
    const isCoordinator = req.user.role === 'coordinator';
    const [result] = await pool.query(
      isCoordinator
        ? "UPDATE tasks SET status = 'archived' WHERE id = ?"
        : "UPDATE tasks SET status = 'archived' WHERE id = ? AND created_by = ?",
      isCoordinator ? [id] : [id, req.user.user_id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
