const mongoose = require("mongoose");

const opportunitySchema = new mongoose.Schema({
  name: String,
  description: String,
  amount: String,
  stage: String,
  type: String,
  geography: String,
  size: String,
  eligibility: String
});

module.exports = mongoose.model("Opportunity", opportunitySchema);