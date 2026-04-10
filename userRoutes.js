const express = require("express");
const router = express.Router();

const { updateUser } = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.put("/me", authMiddleware, updateUser);

module.exports = router;

const { saveOpportunity, getSavedOpportunities } = require("../controllers/userController");

router.post("/me/save-opportunity", authMiddleware, saveOpportunity);
router.get("/me/saved", authMiddleware, getSavedOpportunities);