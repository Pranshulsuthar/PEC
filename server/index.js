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

const app = express();
app.use(cors());
app.use(express.json());
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

const PORT = process.env.PORT || 5000;
// Initialize DB schema before starting server
const { init } = require('./config/initDb');
init().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
