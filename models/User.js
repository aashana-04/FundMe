const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  primaryIntent: String,
  isStudent: Boolean,
  startupStage: String,
  domain: String,
  country: String,
  state: String,
  fundingRange: String
});

module.exports = mongoose.model("User", UserSchema);