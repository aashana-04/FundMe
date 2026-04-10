const express = require("express");
const router = express.Router();   

const authMiddleware = require("../middleware/authMiddleware");
const { updatePost, deletePost, deleteReply } = require("../controllers/communityController");

router.put("/:id", authMiddleware, updatePost);
router.delete("/:id", authMiddleware, deletePost);
router.delete("/:id/reply/:replyId", authMiddleware, deleteReply);

module.exports = router;