require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const mentorRoutes = require('./routes/mentors');
const coordinatorRoutes = require('./routes/coordinators');
const taskRoutes = require('./routes/tasks');
const submissionRoutes = require('./routes/submissions');
const newsRoutes = require('./routes/news');
const eventRoutes = require('./routes/events');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const { verifyToken } = require('./middleware/authMiddleware');
const pool = require('./config/db');
const { init } = require('./config/initDb');

const app = express();
app.use(cors());
app.use(express.json({ strict: true }));

// Global error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  next(err);
});
app.use(express.static(path.join(__dirname, '..')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes – JWT verification
app.use('/api', verifyToken);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/coordinators', coordinatorRoutes);
app.use('/api/admin', coordinatorRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);

const PORT = Number.parseInt(process.env.PORT || '5000', 10);

async function start() {
  try {
    await init();
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    const shutdown = async () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    process.exitCode = 1;
  }
}

start();
