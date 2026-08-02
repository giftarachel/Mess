require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const pool    = require("./db");

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://www.eatzy.xyz",
      "https://eatzy.xyz",
    ];
    if (
      allowed.includes(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.onrender\.com$/.test(origin)
    ) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/preferences",   require("./routes/preferences"));
app.use("/api/leave",         require("./routes/leave"));
app.use("/api/menu",          require("./routes/menu"));
app.use("/api/stats",         require("./routes/stats"));
app.use("/api/feedback",      require("./routes/feedback"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/smartprep",     require("./routes/smartprep"));

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// Seed endpoint
app.get("/api/seed-users", async (req, res) => {
  const bcrypt = require("bcryptjs");
  const users = [
    { userId: "ashwin@karunya.edu.in",      name: "Ashwin",     password: "URK25CS1195", role: "student" },
    { userId: "gifta@karunya.edu.in",       name: "Gifta",      password: "URK25CS1079", role: "student" },
    { userId: "eamil@karunya.edu.in",       name: "Eamil",      password: "URK25CS9065", role: "student" },
    { userId: "prethiksha@karunya.edu.in",  name: "Prethiksha", password: "URK25CS9030", role: "student" },
    { userId: "manager@karunya.edu.in",     name: "Manager",    password: "MESS_MGR01",  role: "manager" },
  ];
  const results = [];
  try {
    for (const u of users) {
      const hashed = await bcrypt.hash(u.password, 10);
      const avatar = u.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      await pool.query(`
        INSERT INTO users (user_id, name, password, role, avatar)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (user_id) DO UPDATE SET
          name=EXCLUDED.name, password=EXCLUDED.password, avatar=EXCLUDED.avatar
      `, [u.userId, u.name, hashed, u.role, avatar]);
      results.push(`upserted: ${u.userId}`);
    }
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SCHEDULED NOTIFICATION TRIGGERS ─────────────────────────────────────────
function scheduleWindowNotifications() {
  const { isSelectionOpen, getDeadlineInfo } = require("./utils/week");
  const { pushSystemNotification } = require("./routes/notifications");

  let wasOpen = isSelectionOpen();

  // Check every 30 seconds if the selection window state has changed
  setInterval(async () => {
    const nowOpen = isSelectionOpen();
    const { weekId } = getDeadlineInfo();

    if (!wasOpen && nowOpen) {
      // Window just opened → notify students
      await pushSystemNotification({
        type: "window_open",
        title: "🍳 Selection Window Open!",
        message: `Breakfast selection for week ${weekId} is now open. Submit your choices before Sunday 11:59 PM.`,
        targetRole: "student",
      });
      await pushSystemNotification({
        type: "window_open",
        title: "📋 Selection Window Opened",
        message: `Students can now select breakfast for week ${weekId}. Monitor responses in Analytics.`,
        targetRole: "manager",
      });
      wasOpen = true;
    }

    if (wasOpen && !nowOpen) {
      // Window just closed → notify both
      await pushSystemNotification({
        type: "window_close",
        title: "⏰ Selection Window Closed",
        message: `Breakfast selection for week ${weekId} is now closed. Your choices have been saved.`,
        targetRole: "student",
      });
      await pushSystemNotification({
        type: "window_close",
        title: "📊 Selection Deadline Reached",
        message: `Selection window for week ${weekId} has closed. Generate the demand report from Analytics.`,
        targetRole: "manager",
      });
      wasOpen = false;
    }
  }, 30000);
}

// Start server
pool.connect()
  .then(client => {
    client.release();
    console.log("✅ Connected to PostgreSQL (Supabase)");
    const PORT = process.env.PORT || 5004;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // Start window state watcher
      scheduleWindowNotifications();

      // Keep Render free tier awake
      if (process.env.RENDER_EXTERNAL_URL) {
        setInterval(() => {
          fetch(`${process.env.RENDER_EXTERNAL_URL}/api/health`)
            .then(() => console.log("Keep-alive ping sent"))
            .catch(() => {});
        }, 14 * 60 * 1000);
      }
    });
  })
  .catch(err => {
    console.error("❌ PostgreSQL connection error:", err.message);
    process.exit(1);
  });
