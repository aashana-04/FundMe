const express = require("express");
const router = express.Router();

const { getGuidance } = require("../controllers/aiController");

router.post("/guidance", getGuidance);

module.exports = router;