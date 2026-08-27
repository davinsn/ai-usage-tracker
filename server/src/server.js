require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
    testDatabase
} = require("./db");

const usageRoutes =
    require("./routes/usage");

const aiRoutes =
    require("./routes/ai");

const app =
    express();

const PORT =
    Number(
        process.env.PORT || 4000
    );

const path = require("path");

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
    cors({
        origin: true
    })
);

app.use(
    express.json({
        limit: "256kb"
    })
);


app.use(
    express.static(
        path.join(__dirname,'..', "dashboard")
    )
);

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "..", "dashboard", "index.html")
    );
});

// ============================================================
// HEALTH
// ============================================================

app.get(
    "/health",
    async (_req, res) => {

        try {

            await testDatabase();

            res.json({

                status: "ok",

                service:
                    "ai-observability-api",

                database:
                    "postgresql",

                provider:
                    "openrouter",

                product:
                    "qwen",

                mock:
                    String(
                        process.env.MOCK_MODE
                    ).toLowerCase() === "true"
            });

        } catch (error) {

            console.error(
                "[ai-obs] HEALTH ERROR:",
                error
            );

            res.status(503).json({

                status: "error",

                database:
                    "postgresql",

                error:
                    error.message
            });
        }
    }
);

// ============================================================
// ROUTES
// ============================================================

app.use(
    "/api/usage",
    usageRoutes
);

app.use(
    "/api/ai",
    aiRoutes
);

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            error:
                "Endpoint not found"
        });
    }
);

// ============================================================
// START
// ============================================================

async function startServer() {

    try {

        await testDatabase();

        app.listen(
            PORT,
            () => {

                console.log(
                    "================================="
                );

                console.log(
                    `[ai-obs] Server running on http://localhost:${PORT}`
                );

                console.log(
                    "[ai-obs] Database: PostgreSQL"
                );

                console.log(
                    "[ai-obs] Provider: OpenRouter"
                );

                console.log(
                    "[ai-obs] Product: Qwen"
                );

                console.log(
                    `[ai-obs] Model: ${
                        process.env.OPENROUTER_DEFAULT_MODEL ||
                        "qwen/qwen3-235b-a22b"
                    }`
                );

                console.log(
                    `[ai-obs] Mock mode: ${
                        process.env.MOCK_MODE
                    }`
                );

                console.log(
                    "================================="
                );
            }
        );

    } catch (error) {

        console.error(
            "[ai-obs] Failed to start server:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
}

startServer();