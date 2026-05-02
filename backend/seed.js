// Run once: node seed.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Menu = require("./models/Menu");

const MENU_DATA = {
  Mon: { Breakfast: ["Poha", "Upma", "Idli"], Lunch: ["Dal Rice", "Rajma Rice", "Chole Bhature"], Dinner: ["Roti + Sabzi", "Fried Rice", "Paneer Curry"] },
  Tue: { Breakfast: ["Paratha", "Dosa", "Cornflakes"], Lunch: ["Kadhi Rice", "Biryani", "Jeera Rice"], Dinner: ["Dal Makhani", "Noodles", "Khichdi"] },
  Wed: { Breakfast: ["Bread Butter", "Poha", "Upma"], Lunch: ["Sambar Rice", "Pulao", "Chole Rice"], Dinner: ["Paneer Butter Masala", "Roti", "Fried Rice"] },
  Thu: { Breakfast: ["Idli", "Vada", "Sprouts"], Lunch: ["Dal Fry", "Aloo Matar", "Biryani"], Dinner: ["Mix Veg", "Chapati", "Rice"] },
  Fri: { Breakfast: ["Poha", "Dosa", "Upma"], Lunch: ["Rajma", "Dal Rice", "Pulao"], Dinner: ["Special Thali", "Roti", "Pasta"] },
  Sat: { Breakfast: ["Chole Bhature", "Paratha", "Cornflakes"], Lunch: ["Biryani", "Kadhi", "Rice"], Dinner: ["Paneer", "Naan", "Kheer"] },
  Sun: { Breakfast: ["Puri Sabzi", "Halwa", "Dosa"], Lunch: ["Special Dal", "Rice", "Gulab Jamun"], Dinner: ["Biryani", "Raita", "Ice Cream"] },
};

const USERS = [
  { userId: "URK25CS1195", name: "Ashwin",     password: "090807",        role: "student" },
  { userId: "URK25CS1079", name: "Gifta",      password: "041007",        role: "student" },
  { userId: "URK25CS9065", name: "Eamil",      password: "170707",        role: "student" },
  { userId: "URK25CS9030", name: "Prethiksha", password: "030518",        role: "student" },
  { userId: "MESS_MGR01",  name: "Manager",    password: "mess@admin2026", role: "manager" },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas");

  // Remove old fake/test users
  const oldIds = ["CS2021001", "CS2021002", "CS2021003", "MGR001"];
  await User.deleteMany({ userId: { $in: oldIds } });
  console.log("Removed old test users");

  // Seed real users (upsert so re-running is safe)
  for (const u of USERS) {
    const exists = await User.findOne({ userId: u.userId });
    if (exists) {
      // Update password and name in case they changed
      exists.password = u.password;
      exists.name = u.name;
      exists.avatar = u.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      await exists.save();
      console.log(`Updated user: ${u.userId}`);
    } else {
      const initials = u.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      await User.create({ ...u, avatar: initials });
      console.log(`Created user: ${u.userId}`);
    }
  }

  // Seed menu
  for (const [day, meals] of Object.entries(MENU_DATA)) {
    await Menu.findOneAndUpdate({ day }, {
      Breakfast: meals.Breakfast,
      Lunch: meals.Lunch,
      Dinner: meals.Dinner,
    }, { upsert: true });
    console.log(`Seeded menu for: ${day}`);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
