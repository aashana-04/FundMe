require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Opportunity = require("./models/Opportunity");
const CommunityPost = require("./models/CommunityPost");
const Resource = require("./models/Resource");
const app = express();

app.use(cors());
app.use(express.json());


mongoose.connect("mongodb+srv://aashanajuly04_db_user:FundMe123@cluster0.hdqkvm7.mongodb.net/?appName=Cluster0")
.then(() => {

  console.log("MongoDB Connected");

  app.listen(5000, () => {
    console.log("Server running on port 5000");
  });

})
.catch((error) => {
  console.log("Database connection error:", error);
});
app.get("/", (req, res) => {
    res.send("FundMe Backend Running");
});

app.post("/users", async (req, res) => {

  try {

    const newUser = new User(req.body);

    await newUser.save();

    res.status(201).json({
      message: "User saved successfully",
      user: newUser
    });

  } catch (error) {

    res.status(500).json({
      message: "Error saving user",
      error: error.message
    });

  }

});

// Get all opportunities
app.get("/opportunities", async (req, res) => {
  try {

    const opportunities = await Opportunity.find();

    res.json(opportunities);

  } catch (error) {

    res.status(500).json({
      message: "Error fetching opportunities",
      error: error.message
    });

  }
});

app.get("/opportunities", async (req, res) => {

 try {

  const { stage, type, geography, size, search } = req.query;

  let filter = {};

  if (stage) {
   filter.stage = stage;
  }

  if (type) {
   filter.type = type;
  }

  if (geography) {
   filter.geography = geography;
  }

  if (size) {
   filter.size = size;
  }

  if (search) {
   filter.name = { $regex: search, $options: "i" };
  }

  const opportunities = await Opportunity.find(filter);

  res.json(opportunities);

 } catch (error) {

  res.status(500).json({
   message: "Error fetching opportunities",
   error: error.message
  });

 }

});

// Add new opportunity
app.post("/opportunities", async (req, res) => {

  try {

    const opportunity = new Opportunity(req.body);

    const savedOpportunity = await opportunity.save();

    res.status(201).json({
      message: "Opportunity added successfully",
      opportunity: savedOpportunity
    });

  } catch (error) {

    res.status(500).json({
      message: "Error adding opportunity",
      error: error.message
    });

  }

});

app.get("/opportunities/recommended/:userId", async (req, res) => {

  try {

    const userId = req.params.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const opportunities = await Opportunity.find();

    const scored = opportunities.map(opp => {

      let score = 0;

      // Stage match
      if (opp.stage === user.startupStage) {
        score += 3;
      }

      // Geography match
      if (opp.geography === user.state || opp.geography === "India" || opp.geography === "All India") {
        score += 2;
      }

      // Funding range match
      if (user.fundingRange && opp.amount.includes(user.fundingRange)) {
        score += 1;
      }

      return {
        ...opp.toObject(),
        score
      };

    });

    scored.sort((a, b) => b.score - a.score);

    const recommendations = scored.slice(0, 6);

    res.json({
      userProfile: user,
      recommendations
    });

  } catch (error) {

    res.status(500).json({
      message: "Error generating recommendations",
      error: error.message
    });

  }

});


// GET all community posts
app.get("/community", async (req, res) => {

  try {

    const posts = await CommunityPost.find().sort({ createdAt: -1 });

    res.json(posts);

  } catch (error) {

    res.status(500).json({
      message: "Error fetching community posts",
      error: error.message
    });

  }

});

// Create new community post
app.post("/community", async (req, res) => {

  try {

    const post = new CommunityPost({
      content: req.body.content
    });

    await post.save();

    res.status(201).json({
      message: "Post created successfully",
      post
    });

  } catch (error) {

    res.status(500).json({
      message: "Error creating post",
      error: error.message
    });

  }

});

// Upvote a community post
app.post("/community/:id/upvote", async (req, res) => {

  try {

    const post = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      { $inc: { upvotes: 1 } },
      { new: true }
    );

    res.json({
      message: "Upvote successful",
      post
    });

  } catch (error) {

    res.status(500).json({
      message: "Error upvoting post",
      error: error.message
    });

  }

});

// Add reply to community post
app.post("/community/:id/reply", async (req, res) => {

  try {

    const post = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          replies: {
            content: req.body.content
          }
        }
      },
      { new: true }
    );

    res.json({
      message: "Reply added successfully",
      post
    });

  } catch (error) {

    res.status(500).json({
      message: "Error adding reply",
      error: error.message
    });

  }

});

app.get("/guidance/:userId", async (req, res) => {

 const user = await User.findById(req.params.userId);

 let summary = "";
 let insights = [];
 let actions = [];
 let avoid = [];

 if (user.startupStage === "Idea") {

  summary =
  "You are currently at the idea stage. Your priority should be validating the problem and building an initial prototype before seeking funding.";

  insights.push({
   title: "Too early for accelerators",
   text: "Most accelerators require a working product and some early traction."
  });

  insights.push({
   title: "Student programs are ideal",
   text: "Hackathons, university incubators, and early innovation grants are accessible at this stage."
  });

  actions.push("Interview 15–20 potential users");
  actions.push("Define the core problem clearly");
  actions.push("Build a simple MVP or prototype");
  actions.push("Apply to early stage innovation programs");

  avoid.push("Incorporating too early");
  avoid.push("Applying to venture capital funds");
  avoid.push("Spending months perfecting business plans");

 }

 if (user.startupStage === "Prototype") {

  summary =
  "You have progressed beyond the idea stage and should now focus on refining your prototype and preparing for incubators or early-stage funding.";

  actions.push("Improve product usability");
  actions.push("Collect user feedback");
  actions.push("Prepare pitch deck");
  actions.push("Apply to incubators");

 }

 res.json({
  summary,
  insights,
  actions,
  avoid
 });

});

app.get("/resources", async (req, res) => {

 try {

  const resources = await Resource.find();

  res.json(resources);

 } catch (error) {

  res.status(500).json({
   message: "Error fetching resources",
   error: error.message
  });

 }

});

const PORT = 5000;
