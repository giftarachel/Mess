const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.userId, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { userId: user.userId, name: user.name, role: user.role, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register  (for seeding / admin use)
router.post("/register", async (req, res) => {
  try {
    const { userId, name, password, role } = req.body;
    const exists = await User.findOne({ userId });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const user = await User.create({ userId, name, password, role: role || "student", avatar: initials });
    res.status(201).json({ message: "User created", userId: user.userId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
