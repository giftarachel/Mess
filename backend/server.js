require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    const allowed = [
      "http://localhost:3000",
      "http://localhost:5173",
    ];
    // Allow any vercel.app or onrender.com subdomain
    if (/\.vercel\.app$/.test(origin) || /\.onrender\.com$/.test(origin) || allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // allow all for now — tighten after confirmed working
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

    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
