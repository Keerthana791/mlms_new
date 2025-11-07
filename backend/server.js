require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Parse = require('./config/parse');

// Import routes
const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/course.routes');
const assignmentRoutes = require('./routes/assignment.routes');
const submissionRoutes = require('./routes/submission.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const materialRoutes = require('./routes/material.routes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/courses', materialRoutes);

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

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app; // For testing