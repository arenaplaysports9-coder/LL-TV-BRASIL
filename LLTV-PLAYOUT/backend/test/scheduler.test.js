const test = require('node:test');
const assert = require('node:assert/strict');
const { addCalendarInterval, nextFutureRun } = require('../src/services/scheduler');

test('scheduler calculates daily and weekly recurrence without changing UTC clock time', () => {
  const start = new Date('2026-11-05T18:45:00.000Z');
  assert.equal(addCalendarInterval(start, 'daily').toISOString(), '2026-11-06T18:45:00.000Z');
  assert.equal(addCalendarInterval(start, 'weekly').toISOString(), '2026-11-12T18:45:00.000Z');
});

test('monthly recurrence clamps end-of-month dates safely', () => {
  assert.equal(addCalendarInterval('2026-01-31T12:30:00.000Z', 'monthly').toISOString(), '2026-02-28T12:30:00.000Z');
  assert.equal(addCalendarInterval('2028-01-31T12:30:00.000Z', 'monthly').toISOString(), '2028-02-29T12:30:00.000Z');
});

test('one-time schedules do not recur and invalid recurrence is rejected', () => {
  assert.equal(addCalendarInterval('2026-11-05T00:00:00.000Z', 'once'), null);
  assert.throws(() => addCalendarInterval('2026-11-05T00:00:00.000Z', 'hourly'), /não suportada/);
});

test('overdue recurring schedules advance to the next future slot instead of replaying a backlog', () => {
  const next = nextFutureRun('2026-11-01T09:00:00.000Z', 'daily', '2026-11-05T10:00:00.000Z');
  assert.equal(next.toISOString(), '2026-11-06T09:00:00.000Z');
});
