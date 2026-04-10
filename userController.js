const User = require("../models/User");

exports.updateUser = async (req, res) => {
  try {
    const userId = req.user;

    const updates = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select("-password");

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const Opportunity = require("../models/Opportunity");

exports.saveOpportunity = async (req, res) => {
  try {
    const userId = req.user;
    const { opportunityId } = req.body;

    const user = await User.findById(userId);

    // prevent duplicate saves
    if (user.savedOpportunities.includes(opportunityId)) {
      return res.status(400).json({ message: "Already saved" });
    }

    user.savedOpportunities.push(opportunityId);
    await user.save();

    res.json({ message: "Opportunity saved" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSavedOpportunities = async (req, res) => {
  try {
    const userId = req.user;

    const user = await User.findById(userId)
      .populate("savedOpportunities");

    res.json(user.savedOpportunities);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};