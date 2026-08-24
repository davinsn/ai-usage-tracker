require("dotenv").config();

const express = require("express");
const usageRoutes = require("./routes/usage");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

app.use("/api/usage", usageRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});