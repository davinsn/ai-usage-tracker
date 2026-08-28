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
// BNM USD → MYR EXCHANGE RATE
// ============================================================

app.get(
    "/api/exchange-rate",
    async (req, res) => {
        try {
            const url =
                "https://api.bnm.gov.my/public/exchange-rate?session=1200&quote=rm";

            console.log(
                "[ai-obs] Fetching BNM exchange rate..."
            );

            const response = await fetch(
                url,
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/vnd.BNM.API.v1+json",
                        "User-Agent":
                            "Mozilla/5.0 AI-Observability-Dashboard"
                    }
                }
            );

            const responseText =
                await response.text();

            console.log(
                "[ai-obs] BNM status:",
                response.status
            );

            if (!response.ok) {
                console.error(
                    "[ai-obs] BNM response:",
                    responseText
                );

                throw new Error(
                    `BNM API returned HTTP ${response.status}`
                );
            }

            let data;

            try {
                data = JSON.parse(responseText);
            } catch (error) {
                console.error(
                    "[ai-obs] BNM returned non-JSON:",
                    responseText
                );

                throw new Error(
                    "BNM returned invalid JSON"
                );
            }

            // ----------------------------------------------------
            // DEBUG THE ACTUAL BNM RESPONSE
            // ----------------------------------------------------

            console.log(
                "[ai-obs] BNM data:",
                JSON.stringify(data, null, 2)
            );

            // ----------------------------------------------------
            // FIND USD
            // ----------------------------------------------------

            if (!Array.isArray(data.data)) {
                throw new Error(
                    "BNM response does not contain a data array"
                );
            }

            const usdRecord =
                data.data.find(
                    item =>
                        String(
                            item.currency_code ||
                            item.currency ||
                            ""
                        )
                            .trim()
                            .toUpperCase() === "USD"
                );

            if (!usdRecord) {
                console.error(
                    "[ai-obs] Available BNM currencies:",
                    data.data.map(
                        item => ({
                            currency_code:
                                item.currency_code,
                            currency:
                                item.currency,
                            unit:
                                item.unit,
                            rate:
                                item.rate
                        })
                    )
                );

                throw new Error(
                    "USD rate not found in BNM response"
                );
            }

            // ----------------------------------------------------
            // EXTRACT RATE
            // ----------------------------------------------------

            const middleRate =
                Number(
                    usdRecord.rate?.middle_rate ??
                    usdRecord.middle_rate
                );

            const buyingRate =
                Number(
                    usdRecord.rate?.buying_rate ??
                    usdRecord.buying_rate
                );

            const sellingRate =
                Number(
                    usdRecord.rate?.selling_rate ??
                    usdRecord.selling_rate
                );

            let rate = middleRate;

            // Some BNM sessions don't publish a middle rate.
            // In that case calculate the midpoint.
            if (
                !Number.isFinite(rate) &&
                Number.isFinite(buyingRate) &&
                Number.isFinite(sellingRate)
            ) {
                rate =
                    (buyingRate + sellingRate) / 2;
            }

            if (
                !Number.isFinite(rate) ||
                rate <= 0
            ) {
                throw new Error(
                    "Valid USD/MYR rate not available"
                );
            }

            // ----------------------------------------------------
            // SUCCESS
            // ----------------------------------------------------

            console.log(
                `[ai-obs] USD/MYR = ${rate}`
            );

            res.json({
                success: true,
                currency: "USD",
                quote: "MYR",

                // Primary field
                rate: rate,

                // Backwards compatibility
                middle_rate: rate,

                buying_rate:
                    Number.isFinite(buyingRate)
                        ? buyingRate
                        : null,

                selling_rate:
                    Number.isFinite(sellingRate)
                        ? sellingRate
                        : null,

                date:
                    usdRecord.rate?.date ??
                    usdRecord.date ??
                    data.meta?.last_updated ??
                    null
            });

        } catch (error) {

            console.error(
                "[ai-obs] BNM exchange rate error:",
                error.message
            );

            res.status(503).json({
                success: false,
                currency: "USD",
                quote: "MYR",
                rate: null,
                middle_rate: null,
                error: error.message
            });
        }
    }
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