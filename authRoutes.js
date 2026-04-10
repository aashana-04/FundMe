const express = require("express");
const router = express.Router();

const { signup, login, getMe, logout } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.post("/logout", logout);
router.post("/logout", authMiddleware, logout);

module.exports = router;