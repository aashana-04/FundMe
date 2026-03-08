const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  content: String,
  author: {
    type: String,
    default: "Anonymous"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const communityPostSchema = new mongoose.Schema({

  content: {
    type: String,
    required: true
  },

  author: {
    type: String,
    default: "Anonymous"
  },

  upvotes: {
    type: Number,
    default: 0
  },

  replies: [replySchema],

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("CommunityPost", communityPostSchema);