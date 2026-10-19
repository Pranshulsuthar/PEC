const http = require('node:http');
const { afterEach, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { attachRealtime } = require('./realtime');

const secret = 'realtime-test-secret';
let server;
let realtime;
let clients;

beforeEach(async () => {
  process.env.JWT_SECRET = secret;
  server = http.createServer();
  clients = [];
  realtime = attachRealtime(server, {
    query: async (_sql, [userId]) => [[
      Number(userId) === 1 ? { id: 1, role: 'student' } : { id: 2, role: 'mentor' }
    ]]
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterEach(async () => {
  await Promise.all(clients.map((client) => new Promise((resolve) => {
    if (client.readyState === WebSocket.CLOSED) return resolve();
    client.once('close', resolve);
    client.close();
  })));
  await new Promise((resolve) => server.close(resolve));
});

function connect(userId, role) {
  const client = new WebSocket('ws://127.0.0.1:' + server.address().port + '/ws');
  clients.push(client);
  const messages = [];
  const authenticated = new Promise((resolve, reject) => {
    client.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      messages.push(message);
      if (message.type === 'authenticated') resolve();
    });
    client.once('error', reject);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'authenticate',
        token: jwt.sign({ user_id: userId, role }, secret)
      }));
    });
  });
  return { client, messages, authenticated };
}

test('authenticates users and sends refresh events only to the targeted account', async () => {
  const student = connect(1, 'student');
  const mentor = connect(2, 'mentor');
  await Promise.all([student.authenticated, mentor.authenticated]);

  const refresh = new Promise((resolve) => student.client.once('message', (raw) => resolve(JSON.parse(raw.toString()))));
  realtime.publishToUser(1, { type: 'dashboard.refresh', data: { resource: 'test' } });

  const message = await refresh;
  assert.equal(message.type, 'dashboard.refresh');
  assert.deepEqual(message.data, { resource: 'test' });
  assert.match(message.occurred_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(mentor.messages.length, 1);
});

test('rejects a valid token whose role does not match the database account', async () => {
  const client = connect(1, 'mentor');
  const closeCode = await new Promise((resolve, reject) => {
    client.client.once('close', resolve);
    client.client.once('error', reject);
  });
  assert.equal(closeCode, 4401);
});
