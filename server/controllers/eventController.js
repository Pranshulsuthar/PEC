const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const [events] = await pool.query("SELECT e.*, er.registration_status FROM events e LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = ? AND er.registration_status = 'registered' WHERE e.status = 'published' AND e.event_date >= CURDATE() ORDER BY e.event_date ASC", [req.user.user_id]);
      return res.json({ success: true, events });
    }
    if (req.user.role === 'mentor') {
      const [events] = await pool.query("SELECT e.*, er.registration_status FROM events e LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = ? AND er.registration_status = 'registered' WHERE e.status = 'published' AND e.event_date >= CURDATE() AND EXISTS (SELECT 1 FROM mentor_student ms WHERE ms.mentor_id = ? AND ms.status = 'active') ORDER BY e.event_date ASC", [req.user.user_id, req.user.user_id]);
      return res.json({ success: true, events });
    }
    const [rows] = await pool.query("SELECT * FROM events ORDER BY event_date ASC");
    res.json({ success: true, events: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.register = async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) return res.status(400).json({ success: false, message: 'Valid event ID required' });
  try {
    const [[event]] = await pool.query("SELECT id FROM events WHERE id = ? AND status = 'published' AND event_date >= CURDATE()", [eventId]);
    if (!event) return res.status(404).json({ success: false, message: 'Event is unavailable or has ended' });
    await pool.query("INSERT INTO event_registrations (event_id, user_id, registration_status) VALUES (?, ?, 'registered') ON DUPLICATE KEY UPDATE registration_status = 'registered', registered_at = CURRENT_TIMESTAMP", [eventId, req.user.user_id]);
    res.status(201).json({ success: true, message: 'Registered for event' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.cancelRegistration = async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) return res.status(400).json({ success: false, message: 'Valid event ID required' });
  try {
    const [result] = await pool.query("UPDATE event_registrations SET registration_status = 'cancelled' WHERE event_id = ? AND user_id = ? AND registration_status = 'registered'", [eventId, req.user.user_id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Registration not found' });
    res.json({ success: true, message: 'Registration cancelled' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid event ID required' });
  try {
    const [rows] = await pool.query("SELECT * FROM events WHERE id = ? AND (? = 'coordinator' OR status = 'published')", [id, req.user.role]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, event: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  if (!title || !event_date) return res.status(400).json({ success: false, message: 'Title and date required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO events (title, description, event_date, start_time, end_time, location, image_url, status, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [title, description || null, event_date, start_time || null, end_time || null, location || null, image_url || null, status || 'draft', req.user.user_id]
    );
    res.status(201).json({ success: true, event_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const id = req.params.id;
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE events SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, location = ?, image_url = ?, status = ? WHERE id = ?',
      [title, description, event_date, start_time, end_time, location, image_url, status, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, message: 'Event updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await pool.query('DELETE FROM events WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
