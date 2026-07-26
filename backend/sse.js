/**
 * SSE (Server-Sent Events) manager
 * Keeps a registry of connected clients and broadcasts events to them.
 */

const clients = new Map(); // userId -> res (SSE response stream)

function addClient(userId, res) {
  // If user already has a connection, close the old one
  if (clients.has(userId)) {
    try { clients.get(userId).end(); } catch (_) {}
  }
  clients.set(userId, res);
}

function removeClient(userId) {
  clients.delete(userId);
}

/**
 * Send an event to a specific user
 */
function sendToUser(userId, event) {
  const res = clients.get(userId);
  if (res) {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (_) {
      clients.delete(userId);
    }
  }
}

/**
 * Broadcast an event to all connected clients
 * Optional: filter by role using the clients metadata
 */
function broadcast(event, targetRole = "all", connectedUsers = null) {
  for (const [userId, res] of clients.entries()) {
    // If connectedUsers map provided, check role
    if (connectedUsers && targetRole !== "all") {
      const userRole = connectedUsers.get(userId);
      if (userRole !== targetRole) continue;
    }
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (_) {
      clients.delete(userId);
    }
  }
}

function getConnectedCount() {
  return clients.size;
}

module.exports = { addClient, removeClient, sendToUser, broadcast, getConnectedCount };
