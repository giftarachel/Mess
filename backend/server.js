require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: function(origin, callback) {
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
    ) {
      return callback(null, true);
    }
    return callback(null, true); // allow all for now
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/preferences", require("./routes/preferences"));
app.use("/api/leave", require("./routes/leave"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/stats", require("./routes/stats"));

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// One-time seed endpoint — remove after use
app.get("/api/seed-users", async (req, res) => {
  try {
    const User = require("./models/User");
    const bcrypt = require("bcryptjs");

    const users = [
      { userId: "URK25CS1195", name: "Ashwin",     password: "090807",        role: "student" },
      { userId: "URK25CS1079", name: "Gifta",      password: "041007",        role: "student" },
      { userId: "URK25CS9065", name: "Eamil",      password: "170707",        role: "student" },
      { userId: "URK25CS9030", name: "Prethiksha", password: "030518",        role: "student" },
      { userId: "MESS_MGR01",  name: "Manager",    password: "mess@admin2026", role: "manager" },
    ];

    // Remove old fake users
    await User.deleteMany({ userId: { $in: ["CS2021001","CS2021002","CS2021003","MGR001"] } });

    const results = [];
    for (const u of users) {
      const exists = await User.findOne({ userId: u.userId });
      const initials = u.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      if (exists) {
        exists.name = u.name;
        exists.password = u.password; // model pre-save hook will hash it
        exists.avatar = initials;
        await exists.save();
        results.push(`updated: ${u.userId}`);
      } else {
        await User.create({ ...u, avatar: initials });
        results.push(`created: ${u.userId}`);
      }
    }
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB Atlas");

    // One-time index fix: drop stale index missing weekId
    try {
      const col = mongoose.connection.collection("preferences");
      const indexes = await col.indexes();
      const stale = indexes.find(i => i.name === "userId_1_day_1_meal_1");
      if (stale) {
        await col.dropIndex("userId_1_day_1_meal_1");
        console.log("Dropped stale index: userId_1_day_1_meal_1");
        await col.createIndex(
          { userId: 1, weekId: 1, day: 1, meal: 1 },
          { unique: true }
        );
        console.log("Created correct index: userId_1_weekId_1_day_1_meal_1");
      }
    } catch (e) {
      console.error("Index fix error:", e.message);
    }

    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
      // Keep Render free tier awake — ping every 14 minutes
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
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
