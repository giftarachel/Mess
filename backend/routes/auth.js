const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../db");

// POST /api/auth/login
// userId = institutional email, password = register number
router.post("/login", async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password)
      return res.status(400).json({ message: "Email and register number are required" });

    const result = await pool.query(
      "SELECT * FROM users WHERE user_id = $1",
      [userId.trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.user_id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register (admin/seed use)
router.post("/register", async (req, res) => {
  try {
    const { userId, name, password, role } = req.body;
    const email = userId.trim().toLowerCase();

    const exists = await pool.query("SELECT id FROM users WHERE user_id = $1", [email]);
    if (exists.rows.length) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const avatar = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    await pool.query(
      "INSERT INTO users (user_id, name, password, role, avatar) VALUES ($1,$2,$3,$4,$5)",
      [email, name, hashed, role || "student", avatar]
    );

    res.status(201).json({ message: "User created", userId: email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
