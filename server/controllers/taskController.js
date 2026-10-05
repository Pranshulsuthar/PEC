const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    let sql = "SELECT t.*, COUNT(DISTINCT ts.id) AS submission_count FROM tasks t LEFT JOIN task_submissions ts ON ts.task_id = t.id";
    const params = [];
    if (req.user.role === 'student') {
      sql += " JOIN task_assignments ta ON ta.task_id = t.id AND ta.student_id = ? AND ta.status <> 'completed' WHERE t.status = 'published'";
      params.push(req.user.user_id);
    } else if (req.user.role === 'mentor') {
      sql += " JOIN mentor_profiles mp ON mp.user_id = ? WHERE t.status <> 'archived' AND (t.created_by = ? OR EXISTS (SELECT 1 FROM task_assignments ta JOIN mentor_student ms ON ms.student_id = ta.student_id AND ms.mentor_id = ? AND ms.status = 'active' WHERE ta.task_id = t.id))";
      params.push(req.user.user_id, req.user.user_id, req.user.user_id);
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
      sql += " JOIN task_assignments ta ON ta.task_id = t.id AND ta.student_id = ? AND ta.status <> 'completed' WHERE t.id = ? AND t.status = 'published'";
      params.push(req.user.user_id, id);
    } else if (req.user.role === 'mentor') {
      sql += " JOIN mentor_profiles mp ON mp.user_id = ? WHERE t.id = ? AND t.status <> 'archived' AND (t.created_by = ? OR EXISTS (SELECT 1 FROM task_assignments ta JOIN mentor_student ms ON ms.student_id = ta.student_id AND ms.mentor_id = ? AND ms.status = 'active' WHERE ta.task_id = t.id))";
      params.push(req.user.user_id, id, req.user.user_id, req.user.user_id);
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
  const { title, description, difficulty, category, deadline, student_id: requestedStudentId } = req.body;
  const creatorRole = req.user.role;
  const parsedStudentId = requestedStudentId === undefined || requestedStudentId === '' ? null : Number(requestedStudentId);
  if (!title || !String(title).trim()) return res.status(400).json({ success: false, message: 'Task title is required' });
  if (difficulty && !['Easy', 'Medium', 'Hard'].includes(difficulty)) return res.status(400).json({ success: false, message: 'Invalid difficulty' });
  if (category && String(category).length > 100) return res.status(400).json({ success: false, message: 'Category is too long' });
  if (deadline && Number.isNaN(Date.parse(deadline))) return res.status(400).json({ success: false, message: 'Invalid deadline' });
  if (creatorRole === 'mentor' && (!Number.isInteger(parsedStudentId) || parsedStudentId < 1)) return res.status(400).json({ success: false, message: 'Select a mentee for this task' });
  if (creatorRole === 'mentor') {
    const [[profile]] = await pool.query('SELECT id FROM mentor_profiles WHERE user_id = ?', [req.user.user_id]);
    if (!profile) return res.status(403).json({ success: false, message: 'Mentor profile required' });
  }
  if (creatorRole === 'coordinator' && parsedStudentId !== null) return res.status(400).json({ success: false, message: 'Coordinators publish challenges for students; use mentor assignment to assign an individual task.' });
  if (creatorRole !== 'mentor' && creatorRole !== 'coordinator') return res.status(403).json({ success: false, message: 'Only mentors and coordinators can create tasks' });
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let targetStudent = null;
      if (creatorRole === 'mentor' && parsedStudentId !== null) {
        const [assigned] = await connection.query("SELECT ms.student_id FROM mentor_student ms JOIN users u ON u.id = ms.student_id AND u.role = 'student' WHERE ms.mentor_id = ? AND ms.student_id = ? AND ms.status = 'active' FOR UPDATE", [req.user.user_id, parsedStudentId]);
        if (!assigned.length) {
          await connection.rollback();
          return res.status(403).json({ success: false, message: 'You can only assign tasks to your mentees.' });
        }
        targetStudent = parsedStudentId;
      }
      const [result] = await connection.query(
        'INSERT INTO tasks (title, description, difficulty, category, deadline, created_by, status) VALUES (?,?,?,?,?,?,?)',
        [String(title).trim(), description ? String(description).trim() : null, difficulty || 'Easy', category || null, deadline || null, req.user.user_id, 'published']
      );
      const [[creator]] = await connection.query('SELECT role FROM users WHERE id = ?', [req.user.user_id]);
      let assignedCount = 0;
      if (creatorRole === 'mentor' && targetStudent) {
        await connection.query('INSERT INTO task_assignments (task_id, student_id, assigned_by, deadline) VALUES (?,?,?,?)', [result.insertId, targetStudent, req.user.user_id, deadline || null]);
        assignedCount = 1;
        await connection.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [targetStudent, 'New task assigned', String(title).trim(), 'task']);
      } else if (creatorRole === 'coordinator') {
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student'");
        const [assignments] = await connection.query("INSERT INTO task_assignments (task_id, student_id, assigned_by, deadline) SELECT ?, id, ?, ? FROM users WHERE role = 'student'", [result.insertId, req.user.user_id, deadline || null]);
        assignedCount = assignments.affectedRows;
        for (const student of students) await connection.query('INSERT INTO notifications (user_id, title, `message`, type) VALUES (?,?,?,?)', [student.id, 'New challenge available', String(title).trim(), 'challenge']);
      } else if (creatorRole === 'mentor' && !targetStudent) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Select a mentee before creating a task.' });
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
  if (!['mentor', 'coordinator'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Task management access required' });
  const id = Number(req.params.id);
  const { title, description, difficulty, category, deadline, status } = req.body;
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid task ID is required' });
  if (difficulty && !['Easy', 'Medium', 'Hard'].includes(difficulty)) return res.status(400).json({ success: false, message: 'Invalid difficulty' });
  if (status && !['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid task status' });
  if (deadline && Number.isNaN(Date.parse(deadline))) return res.status(400).json({ success: false, message: 'Invalid deadline' });
  try {
    const [result] = await pool.query(
      "UPDATE tasks t SET t.title = COALESCE(?, t.title), t.description = COALESCE(?, t.description), t.difficulty = COALESCE(?, t.difficulty), t.category = COALESCE(?, t.category), t.deadline = COALESCE(?, t.deadline), t.status = COALESCE(?, t.status) WHERE t.id = ? AND (? = 'coordinator' OR t.created_by = ?)",
      [title ? String(title).trim() : null, description === undefined ? null : description, difficulty || null, category === undefined ? null : category, deadline || null, status || null, id, req.user.role, req.user.user_id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Task not found or not editable' });
    res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  if (!['mentor', 'coordinator'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Task management access required' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid task ID is required' });
  try {
    const [result] = await pool.query("UPDATE tasks SET status = 'archived' WHERE id = ? AND (? = 'coordinator' OR created_by = ?)", [id, req.user.role, req.user.user_id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Task not found or not editable' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
