const pool = require('../config/db');
// List all mentors (basic info)
exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT mp.id AS profile_id, u.id AS user_id, u.name, u.email, mp.specialization, mp.experience, mp.bio FROM mentor_profiles mp JOIN users u ON mp.user_id = u.id');
    res.json({ success: true, mentors: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get mentor profile + assigned students
exports.getById = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT mp.*, u.name, u.email FROM mentor_profiles mp JOIN users u ON mp.user_id = u.id WHERE mp.user_id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Mentor not found' });
    const mentor = rows[0];
    // Assigned students
    const [studentRows] = await pool.query(
      `SELECT sp.id AS profile_id, u.id AS student_id, u.name AS student_name, u.email, sp.branch, sp.roll_number
       FROM mentor_student ms JOIN users u ON ms.student_id = u.id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE ms.mentor_id = ? AND ms.status = 'active'`,
      [id]
    );
    mentor.assigned_students = studentRows;
    res.json({ success: true, mentor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update mentor profile (self)
exports.update = async (req, res) => {
  const id = req.params.id;
  const { name, email, expertise, bio } = req.body;
  // Ensure logged-in mentor matches
  if (parseInt(id) !== parseInt(req.user.user_id)) {
    return res.status(403).json({ success: false, message: 'Cannot modify other mentors' });
  }
  try {
    await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.user_id]);
    await pool.query('UPDATE mentor_profiles SET specialization = ?, bio = ? WHERE user_id = ?', [expertise, bio, req.user.user_id]);
    res.json({ success: true, message: 'Mentor profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get mentees assigned to this mentor (protected)
exports.getMentees = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT sp.id AS profile_id, u.id AS student_id, u.name, u.email, sp.branch, sp.roll_number
       FROM mentor_student ms JOIN users u ON ms.student_id = u.id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE ms.mentor_id = ? AND ms.status = 'active'`,
      [id]
    );
    res.json({ success: true, mentees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
