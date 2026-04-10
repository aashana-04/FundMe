const Application = require("../models/Application");
const Opportunity = require("../models/Opportunity"); // ✅ IMPORTANT (you were missing this)


// 🚀 APPLY TO OPPORTUNITY
exports.applyToOpportunity = async (req, res) => {
  try {
    const userId = req.user;

    // ✅ safety check (prevents crash if body missing)
    if (!req.body || !req.body.opportunityId) {
      return res.status(400).json({ message: "opportunityId is required" });
    }

    const { opportunityId } = req.body;

    // ✅ check if opportunity exists
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    // ✅ prevent duplicate application
    const existing = await Application.findOne({
      user: userId,
      opportunity: opportunityId
    });

    if (existing) {
      return res.status(400).json({ message: "Already applied" });
    }

    // ✅ create application
    const application = new Application({
      user: userId,
      opportunity: opportunityId
    });

    await application.save();

    res.json({ message: "Application submitted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// 🚀 GET MY APPLICATIONS
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user;

    const applications = await Application.find({ user: userId })
      .populate("opportunity"); // ✅ returns full opportunity details

    res.json(applications);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};