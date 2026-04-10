const CommunityPost = require("../models/CommunityPost");

exports.updatePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user;

    const post = await CommunityPost.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // 🔥 AUTH CHECK
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // update content
    if (req.body.content) {
      post.content = req.body.content;
    }

    await post.save();

    res.json(post);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE POST
exports.deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user;

    const post = await CommunityPost.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // 🔥 AUTH CHECK
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await post.deleteOne();

    res.json({ message: "Post deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE REPLY
exports.deleteReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const userId = req.user;

    const post = await CommunityPost.findById(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const reply = post.replies.id(replyId);

    if (!reply) {
      return res.status(404).json({ message: "Reply not found" });
    }

    // 🔥 AUTH CHECK
    if (reply.author.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    reply.deleteOne();

    await post.save();

    res.json({ message: "Reply deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};