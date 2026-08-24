const express = require("express");
const router = express.Router();

const openrouter = require("../openrouter");

router.post("/test", async (req, res) => {
    try {
        const response = await openrouter.chat.completions.create({
            model: "openai/gpt-5",
            messages: [
                {
                    role: "user",
                    content: "Say hello and nothing else."
                }
            ]
        });

        res.json({
            success: true,
            model: response.model,
            response: response.choices[0].message.content,
            usage: response.usage
        });

    } catch (error) {
        console.error("OpenRouter error:", error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;