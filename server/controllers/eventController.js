const pool = require('../config/db');
const { publishDashboardUpdate } = require('../services/realtime');

function visibleEventPredicate(role, userId) {
  if (role === 'coordinator') return { sql: '1 = 1', params: [] };
  if (role === 'mentor') {
    return {
      sql: "(e.created_by = ? OR EXISTS (SELECT 1 FROM users author WHERE author.id = e.created_by AND author.role = 'coordinator'))",
      params: [userId]
    };
  }
  if (role === 'student') {
    return {
      sql: "(EXISTS (SELECT 1 FROM users author WHERE author.id = e.created_by AND author.role = 'coordinator') OR EXISTS (SELECT 1 FROM mentor_student ms WHERE ms.student_id = ? AND ms.mentor_id = e.created_by AND ms.status = 'active'))",
      params: [userId]
    };
  }
  return { sql: '1 = 0', params: [] };
}

exports.getAll = async (req, res) => {
  try {
    const visibility = visibleEventPredicate(req.user.role, req.user.user_id);
    if (req.user.role === 'student') {
      const [events] = await pool.query("SELECT e.*, er.registration_status FROM events e LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = ? AND er.registration_status = 'registered' WHERE e.status = 'published' AND e.event_date >= CURDATE() AND " + visibility.sql + ' ORDER BY e.event_date ASC', [req.user.user_id, ...visibility.params]);
      return res.json({ success: true, events });
    }
    if (req.user.role === 'mentor') {
      const [events] = await pool.query("SELECT e.*, er.registration_status FROM events e LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = ? AND er.registration_status = 'registered' WHERE e.status = 'published' AND e.event_date >= CURDATE() AND " + visibility.sql + ' ORDER BY e.event_date ASC', [req.user.user_id, ...visibility.params]);
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
    const visibility = visibleEventPredicate(req.user.role, req.user.user_id);
    const [[event]] = await pool.query("SELECT e.id FROM events e WHERE e.id = ? AND e.status = 'published' AND e.event_date >= CURDATE() AND " + visibility.sql, [eventId, ...visibility.params]);
    if (!event) return res.status(404).json({ success: false, message: 'Event is unavailable or has ended' });
    await pool.query("INSERT INTO event_registrations (event_id, user_id, registration_status) VALUES (?, ?, 'registered') ON DUPLICATE KEY UPDATE registration_status = 'registered', registered_at = CURRENT_TIMESTAMP", [eventId, req.user.user_id]);
    publishDashboardUpdate(req, { userIds: [req.user.user_id], roles: ['coordinator'], resource: 'event.registration' });
    res.status(201).json({ success: true, message: 'Registered for event' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.cancelRegistration = async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId < 1) return res.status(400).json({ success: false, message: 'Valid event ID required' });
  try {
    const [result] = await pool.query("UPDATE event_registrations SET registration_status = 'cancelled' WHERE event_id = ? AND user_id = ? AND registration_status = 'registered'", [eventId, req.user.user_id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Registration not found' });
    publishDashboardUpdate(req, { userIds: [req.user.user_id], roles: ['coordinator'], resource: 'event.registration' });
    res.json({ success: true, message: 'Registration cancelled' });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid event ID required' });
  try {
    const visibility = visibleEventPredicate(req.user.role, req.user.user_id);
    const [rows] = await pool.query('SELECT e.* FROM events e WHERE e.id = ? AND (' + (req.user.role === 'coordinator' ? '1 = 1' : "e.status = 'published'") + ') AND ' + visibility.sql, [id, ...visibility.params]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, event: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  const eventTitle = typeof title === 'string' ? title.trim() : '';
  if (!eventTitle || eventTitle.length > 255 || !event_date) return res.status(400).json({ success: false, message: 'Enter a title of up to 255 characters and an event date' });
  if (status && !['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid event status' });
  const eventDate = String(event_date);
  const parsedEventDate = new Date(eventDate + 'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(parsedEventDate.getTime()) || parsedEventDate.toISOString().slice(0, 10) !== eventDate) return res.status(400).json({ success: false, message: 'Enter a valid event date' });
  if ([start_time, end_time].some(function (time) { return time && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time); })) return res.status(400).json({ success: false, message: 'Enter valid event times' });
  if (start_time && end_time && end_time <= start_time) return res.status(400).json({ success: false, message: 'End time must be later than start time' });
  try {
    if (req.user.role === 'mentor') {
      const [[assignment]] = await pool.query("SELECT 1 AS assigned FROM mentor_student WHERE mentor_id = ? AND status = 'active' LIMIT 1", [req.user.user_id]);
      if (!assignment) return res.status(409).json({ success: false, message: 'You need an assigned mentee before scheduling a meeting' });
      const [[futureEvent]] = await pool.query('SELECT TIMESTAMP(?, ?) >= NOW() AS is_future', [eventDate, start_time || '00:00:00']);
      if (!futureEvent.is_future) return res.status(400).json({ success: false, message: 'Choose a future meeting date and time' });
    }
    const eventStatus = status || (req.user.role === 'mentor' ? 'published' : 'draft');
    const [result] = await pool.query(
      'INSERT INTO events (title, description, event_date, start_time, end_time, location, image_url, status, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [eventTitle, description || null, eventDate, start_time || null, end_time || null, location || null, image_url || null, eventStatus, req.user.user_id]
    );
    publishDashboardUpdate(req, { roles: ['student', 'mentor', 'coordinator'], resource: 'event.created' });
    res.status(201).json({ success: true, event_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const id = req.params.id;
  const { title, description, event_date, start_time, end_time, location, image_url, status } = req.body;
  if (status && !['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid event status' });
  try {
    const ownership = req.user.role === 'coordinator' ? '' : ' AND created_by = ?';
    const [result] = await pool.query(
      'UPDATE events SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, location = ?, image_url = ?, status = ? WHERE id = ?' + ownership,
      [title, description, event_date, start_time, end_time, location, image_url, status, id, ...(ownership ? [req.user.user_id] : [])]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Event not found' });
    publishDashboardUpdate(req, { roles: ['student', 'mentor', 'coordinator'], resource: 'event.updated' });
    res.json({ success: true, message: 'Event updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  const id = req.params.id;
  try {
    const ownership = req.user.role === 'coordinator' ? '' : ' AND created_by = ?';
    const [result] = await pool.query('DELETE FROM events WHERE id = ?' + ownership, [id, ...(ownership ? [req.user.user_id] : [])]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Event not found' });
    publishDashboardUpdate(req, { roles: ['student', 'mentor', 'coordinator'], resource: 'event.deleted' });
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
