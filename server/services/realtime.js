const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');

const clientsByUser = new Map();
const clientsByRole = new Map();

function send(client, message) {
  if (client.readyState !== WebSocket.OPEN) return;
  client.send(JSON.stringify(message));
}

function addClient(registry, key, client) {
  const clients = registry.get(key) || new Set();
  clients.add(client);
  registry.set(key, clients);
}

function removeClient(registry, key, client) {
  const clients = registry.get(key);
  if (!clients) return;
  clients.delete(client);
  if (!clients.size) registry.delete(key);
}

function publish(registry, key, event) {
  if (!key || !event || typeof event.type !== 'string') return;
  const clients = registry.get(String(key));
  if (!clients) return;
  const message = JSON.stringify({ type: event.type, data: event.data || {}, occurred_at: new Date().toISOString() });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

function attachRealtime(server, pool) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on('upgrade', (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
    } catch (error) {
      socket.destroy();
      return;
    }
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const origin = request.headers.origin;
    if (origin) {
      let originUrl;
      try {
        originUrl = new URL(origin);
      } catch (error) {
        socket.destroy();
        return;
      }
      if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.host !== request.headers.host) {
        socket.destroy();
        return;
      }
    }

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client);
    });
  });

  webSocketServer.on('connection', (client) => {
    let authenticatedUser = null;
    let authenticating = false;
    const authenticationTimeout = setTimeout(() => {
      if (!authenticatedUser) client.close(4401, 'Authentication required');
    }, 5000);

    client.on('message', async (rawMessage) => {
      if (authenticatedUser || authenticating) {
        client.close(4403, 'Client messages are not supported');
        return;
      }

      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch (error) {
        client.close(4400, 'Invalid message');
        return;
      }
      if (!message || message.type !== 'authenticate' || typeof message.token !== 'string' || message.token.length > 4096) {
        client.close(4401, 'Authentication required');
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(message.token, process.env.JWT_SECRET || 'change_this_to_a_secure_secret');
      } catch (error) {
        client.close(4401, 'Invalid token');
        return;
      }

      const userId = Number(decoded.user_id);
      if (!Number.isInteger(userId) || userId < 1) {
        client.close(4401, 'Invalid token');
        return;
      }
      authenticating = true;
      try {
        const [[user]] = await pool.query('SELECT id, role FROM users WHERE id = ? AND is_active = 1', [userId]);
        if (client.readyState !== WebSocket.OPEN) return;
        if (!user || user.role !== decoded.role || !['student', 'mentor', 'coordinator'].includes(user.role)) {
          client.close(4401, 'Account is unavailable');
          return;
        }

        authenticatedUser = { id: String(user.id), role: user.role };
        clearTimeout(authenticationTimeout);
        addClient(clientsByUser, authenticatedUser.id, client);
        addClient(clientsByRole, authenticatedUser.role, client);
        send(client, { type: 'authenticated' });
      } catch (error) {
        console.error('WebSocket authentication database error:', error);
        client.close(1011, 'Authentication failed');
      }
    });

    client.on('close', () => {
      clearTimeout(authenticationTimeout);
      if (authenticatedUser) {
        removeClient(clientsByUser, authenticatedUser.id, client);
        removeClient(clientsByRole, authenticatedUser.role, client);
      }
    });
  });

  return {
    publishToUser(userId, event) { publish(clientsByUser, userId, event); },
    publishToUsers(userIds, event) { new Set(userIds.map(String)).forEach((userId) => publish(clientsByUser, userId, event)); },
    publishToRole(role, event) { publish(clientsByRole, role, event); }
  };
}

function publishDashboardUpdate(req, { userIds = [], roles = [], resource = 'dashboard' } = {}) {
  const realtime = req.app.get('realtime');
  if (!realtime) return;
  const event = { type: 'dashboard.refresh', data: { resource } };
  realtime.publishToUsers(userIds, event);
  new Set(roles).forEach((role) => realtime.publishToRole(role, event));
}

module.exports = { attachRealtime, publishDashboardUpdate };
