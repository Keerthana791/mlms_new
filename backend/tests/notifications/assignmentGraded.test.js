const request = require('supertest');

// Ensure server does not start listener in tests
process.env.NODE_ENV = 'test';

jest.mock('../../config/parse', () => require('../mocks/parseMock'));
jest.mock('../../utils/notify', () => ({ notify: jest.fn(async () => 1) }));
// Stub auth middleware to inject a Teacher user in tenant t1 with deterministic id
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const user = Parse.__create('User', { tenantId: 't1', role: 'Teacher', usernameOnTenant: 'teach1', username: 't1:teach1', email: 't@x.com' });
    user.id = 'teach1';
    req.user = user;
    req.sessionToken = 's1';
    req.headers['x-tenant-id'] = 't1';
    req.tenantId = 't1';
    next();
  },
  requireRole: (roles) => (req, res, next) => roles.includes(req.user.get('role')) ? next() : res.status(403).json({ error: 'Forbidden' })
}));

const app = require('../../server');
const Parse = require('../../config/parse');
const { notify } = require('../../utils/notify');

describe('Submission -> ASSIGNMENT_GRADED notification', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('grading submission notifies the student with total=10', async () => {
    // Seed course owned by teach1
    const course = Parse.__create('Course', { tenantId: 't1', teacherId: 'teach1', title: 'Course 1' });
    // Seed assignment in course
    const Assignment = Parse.Object.extend('Assignment');
    const assignment = new Assignment();
    assignment.set('tenantId', 't1');
    assignment.set('courseId', course.id);
    await assignment.save();

    // Seed a student and a submission
    const student = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 'stud1', username: 't1:stud1', email: 's@x.com' });
    const Submission = Parse.Object.extend('Submission');
    const submission = new Submission();
    submission.set('tenantId', 't1');
    submission.set('assignmentId', assignment.id);
    submission.set('studentId', student.id);
    submission.set('status', 'submitted');
    await submission.save();

    // Grade submission
    const res = await request(app)
      .put(`/api/submissions/${assignment.id}/submissions/${submission.id}/grade`)
      .send({ grade: 8, feedback: 'Good job' });

    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('ASSIGNMENT_GRADED');
    expect(payload.tenantId).toBe('t1');
    expect(payload.userIds).toEqual([student.id]);
    expect(payload.data.assignmentId).toBe(assignment.id);
    expect(payload.data.submissionId).toBe(submission.id);
    expect(payload.data.score).toBe(8);
    expect(payload.data.total).toBe(10);
  });
});