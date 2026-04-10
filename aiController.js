const axios = require("axios");

exports.getGuidance = async (req, res) => {
  try {
    const { startupStage, domain, fundingRange } = req.body;

    // Debug (IMPORTANT)
    console.log("OPENAI KEY:", process.env.OPENAI_API_KEY);

    // Step 1: Prompt
    const prompt = `
You are a startup mentor.

User:
- Stage: ${startupStage}
- Domain: ${domain}
- Funding: ${fundingRange}

Give structured JSON with:
- summary
- insights
- actions
- avoid
`;

    // 🧠 Step 2: OpenAI call
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful startup advisor." },
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const output = response.data.choices[0].message.content;

    res.json({ guidance: output });

  } catch (err) {
    console.error(err.response?.data || err.message); // 🔥 better debugging
    res.status(500).json({ error: err.message });
  }
};