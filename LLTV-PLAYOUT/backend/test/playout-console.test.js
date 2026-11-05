const test = require('node:test');
const assert = require('node:assert/strict');
const consoleState = require('../src/services/console');

test('console loads queue and navigates with transport commands', () => {
  const channel = 'test-channel-' + Date.now();
  const queue = [{ id:'a', title:'A' }, { id:'b', title:'B' }];
  let state = consoleState.load(channel, queue);
  assert.equal(state.status, 'stopped');
  assert.equal(state.current.title, 'A');
  state = consoleState.command(channel, 'play');
  assert.equal(state.status, 'playing');
  state = consoleState.command(channel, 'next');
  assert.equal(state.current.title, 'B');
  state = consoleState.command(channel, 'pause');
  assert.equal(state.status, 'paused');
  state = consoleState.command(channel, 'stop');
  assert.equal(state.status, 'stopped');
});

test('console rejects pause without active playback and empty queues', () => {
  const channel = 'empty-' + Date.now();
  consoleState.load(channel, []);
  assert.throws(() => consoleState.command(channel, 'play'), /fila está vazia/);
});
