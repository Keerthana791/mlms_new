require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Parse = require('./config/parse');

// Import routes
const authRoutes = require('./routes/auth.routes');
const quizRoutes = require('./routes/quiz.routes');
const courseRoutes = require('./routes/course.routes');
const assignmentRoutes = require('./routes/assignment.routes');
const submissionRoutes = require('./routes/submission.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const materialRoutes = require('./routes/material.routes');
const userRoutes = require('./routes/user.routes');

const quizQuestionRoutes = require('./routes/quizQuestion.routes');
const quizAttemptRoutes = require('./routes/quizAttempt.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);


app.use('/api/courses', assignmentRoutes);
app.use('/api/courses', materialRoutes);
app.use('/api/courses', quizRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/enrollments', enrollmentRoutes);

app.use('/api/users', userRoutes);

app.use('/api/quizzes', quizQuestionRoutes);
app.use('/api/quizzes', quizAttemptRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Debug Parse connectivity (temporary)
app.get('/debug/parse', async (req, res) => {
  try {
    const count = await new Parse.Query('_User').count({ useMasterKey: true });
    res.json({
      ok: true,
      serverURL: Parse.serverURL,
      appIdSet: !!process.env.PARSE_APP_ID,
      jsKeySet: !!process.env.PARSE_JS_KEY,
      masterKeySet: !!process.env.MASTER_KEY,
      userCount: count,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: e.message,
      code: e.code,
      serverURL: Parse.serverURL,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Daily purge job for notifications
async function purgeNotificationsDaily() {
  try {
    const now = new Date();
    const expired = new Parse.Query('Notification');
    expired.lessThan('expiresAt', now);

    const oldQ = new Parse.Query('Notification');
    oldQ.doesNotExist('expiresAt');
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    oldQ.lessThan('createdAt', cutoff);

    const toDelete = await Parse.Query.or(expired, oldQ).find({ useMasterKey: true });
    if (toDelete.length) {
      await Parse.Object.destroyAll(toDelete, { useMasterKey: true });
      console.log(`[purgeNotificationsDaily] Deleted ${toDelete.length} notifications`);
    }
  } catch (e) {
    console.error('[purgeNotificationsDaily] Error:', e);
  }
}

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
  // Run once at boot and then every 24 hours
  purgeNotificationsDaily();                   // <-- add this
  setInterval(purgeNotificationsDaily, 24 * 60 * 60 * 1000); // <-- add this
}

module.exports = app; // For testing