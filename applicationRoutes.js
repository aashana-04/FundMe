const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  applyToOpportunity,
  getMyApplications
} = require("../controllers/applicationController");

router.post("/", authMiddleware, applyToOpportunity);
router.get("/me", authMiddleware, getMyApplications);

module.exports = router;