const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    let sql = "SELECT t.* FROM tasks t";
    const params = [];
    if (req.user.role === 'student') {
      sql += " JOIN task_assignments ta ON ta.task_id = t.id AND ta.student_id = ? WHERE t.status <> 'archived'";
      params.push(req.user.user_id);
    } else if (req.user.role === 'mentor') {
      sql += " WHERE t.created_by = ? AND t.status <> 'archived'";
      params.push(req.user.user_id);
    } else {
      sql += " WHERE t.status <> 'archived'";
    }
    sql += ' ORDER BY t.created_at DESC';
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
    const params = [id];
    if (req.user.role === 'student') {
      sql += ' JOIN task_assignments ta ON ta.task_id = t.id AND ta.student_id = ? WHERE t.id = ?';
      params.unshift(req.user.user_id);
    } else if (req.user.role === 'mentor') {
      sql += ' WHERE t.id = ? AND t.created_by = ?';
      params.push(req.user.user_id);
    } else {
      sql += ' WHERE t.id = ?';
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
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'INSERT INTO tasks (title, description, difficulty, category, deadline, created_by, status) VALUES (?,?,?,?,?,?,?)',
        [title, description || null, difficulty || 'Easy', category || null, deadline || null, req.user.user_id, 'published']
      );
      if (req.user.role === 'mentor') {
        const [mentees] = await connection.query("SELECT student_id FROM mentor_student WHERE mentor_id = ? AND status = 'active'", [req.user.user_id]);
        for (const mentee of mentees) {
          await connection.query('INSERT INTO task_assignments (task_id, student_id, assigned_by, deadline) VALUES (?,?,?,?)', [result.insertId, mentee.student_id, req.user.user_id, deadline || null]);
        }
      }
      await connection.commit();
      res.status(201).json({ success: true, task_id: result.insertId, assigned_count: req.user.role === 'mentor' ? (await pool.query("SELECT COUNT(*) AS count FROM task_assignments WHERE task_id = ?", [result.insertId]))[0][0].count : 0 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const id = req.params.id;
  const { title, description, difficulty, category, deadline } = req.body;
  try {
    await pool.query(
      'UPDATE tasks SET title = ?, description = ?, difficulty = ?, category = ?, deadline = ?, status = ? WHERE id = ?',
      [title, description, difficulty, category, deadline, req.body.status || 'published', id]
    );
    res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("UPDATE tasks SET status = 'archived' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
