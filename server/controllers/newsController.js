const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM news WHERE status = 'published' ORDER BY created_at DESC LIMIT 10");
    res.json({ success: true, news: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM news WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'News not found' });
    res.json({ success: true, news: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { title, content, image_url, category, status } = req.body;
  if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO news (title, content, image_url, category, created_by, status, published_at) VALUES (?,?,?,?,?,?,?)',
      [title, content, image_url || null, category || null, req.user.user_id, status || 'draft', status === 'published' ? new Date() : null]
    );
    res.status(201).json({ success: true, news_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const id = req.params.id;
  const { title, content, image_url, category, status } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE news SET title = ?, content = ?, image_url = ?, category = ?, status = ?, published_at = ? WHERE id = ?',
      [title, content, image_url || null, category || null, status, status === 'published' ? new Date() : null, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'News not found' });
    res.json({ success: true, message: 'News updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await pool.query('DELETE FROM news WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'News not found' });
    res.json({ success: true, message: 'News deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
