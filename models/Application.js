const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  opportunity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Opportunity",
    required: true
  },
  status: {
    type: String,
    enum: ["applied", "in-review", "accepted", "rejected"],
    default: "applied"
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Application", applicationSchema);