const router = require("express").Router();
const auth   = require("../middleware/auth");
const pool   = require("../db");
const { addClient, removeClient, broadcast, sendToUser, getConnectedCount } = require("../sse");

// Connected users: userId -> role (for role-based broadcasts)
const connectedRoles = new Map();

// ─── SSE STREAM ──────────────────────────────────────────────────────────────
// GET /api/notifications/stream
// Student/Manager connects here to receive real-time events
router.get("/stream", auth, (req, res) => {
  const { userId, role } = req.user;

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Nginx: disable buffering
  res.flushHeaders();

  // Register this client
  addClient(userId, res);
  connectedRoles.set(userId, role);

  // Send welcome ping immediately
  res.write(`data: ${JSON.stringify({
    type: "connected",
    title: "Connected",
    message: "Real-time notifications active",
    timestamp: new Date().toISOString(),
  })}\n\n`);

  // Keep-alive heartbeat every 25s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch (_) { clearInterval(heartbeat); }
  }, 25000);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(userId);
    connectedRoles.delete(userId);
  });
});

// ─── GET NOTIFICATIONS ────────────────────────────────────────────────────────
// GET /api/notifications
// Returns last 30 notifications for this user
router.get("/", auth, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const rows = (await pool.query(`
      SELECT * FROM notifications
      WHERE
        (target_role = 'all' OR target_role = $1 OR target_user = $2)
      ORDER BY created_at DESC
      LIMIT 30
    `, [role, userId])).rows;

    // Mark each with read status
    const result = rows.map(n => ({
      ...n,
      read: (n.read_by || []).includes(userId),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── MARK READ ────────────────────────────────────────────────────────────────
// POST /api/notifications/:id/read
router.post("/:id/read", auth, async (req, res) => {
  try {
    await pool.query(`
      UPDATE notifications
      SET read_by = array_append(read_by, $1)
      WHERE id = $2 AND NOT ($1 = ANY(read_by))
    `, [req.user.userId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── MARK ALL READ ────────────────────────────────────────────────────────────
// POST /api/notifications/read-all
router.post("/read-all", auth, async (req, res) => {
  try {
    const { userId, role } = req.user;
    await pool.query(`
      UPDATE notifications
      SET read_by = array_append(read_by, $1)
      WHERE
        (target_role = 'all' OR target_role = $2 OR target_user = $1)
        AND NOT ($1 = ANY(read_by))
    `, [userId, role]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── BROADCAST (Manager only) ────────────────────────────────────────────────
// POST /api/notifications/broadcast
// Body: { title, message, targetRole? }
router.post("/broadcast", auth, async (req, res) => {
  try {
    if (req.user.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const { title, message, targetRole = "all" } = req.body;
    if (!title || !message) return res.status(400).json({ message: "title and message required" });

    // Save to DB
    const row = (await pool.query(`
      INSERT INTO notifications (type, title, message, target_role)
      VALUES ('broadcast', $1, $2, $3) RETURNING *
    `, [title, message, targetRole])).rows[0];

    // Push via SSE
    const event = {
      type: "broadcast",
      id: row.id,
      title: row.title,
      message: row.message,
      timestamp: row.created_at,
    };
    broadcast(event, targetRole, connectedRoles);

    res.json({ success: true, id: row.id, connected: getConnectedCount() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── INTERNAL: push a system notification (called from other routes) ─────────
// This is exported so other routes can call it
async function pushSystemNotification({ type, title, message, targetRole = "all", targetUser = null }) {
  try {
    const row = (await pool.query(`
      INSERT INTO notifications (type, title, message, target_role, target_user)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [type, title, message, targetRole, targetUser])).rows[0];

    const event = {
      type: row.type,
      id:   row.id,
      title: row.title,
      message: row.message,
      timestamp: row.created_at,
    };

    if (targetUser) {
      sendToUser(targetUser, event);
    } else {
      broadcast(event, targetRole, connectedRoles);
    }
    return row;
  } catch (e) {
    console.error("pushSystemNotification error:", e.message);
  }
}

module.exports = router;
module.exports.pushSystemNotification = pushSystemNotification;
