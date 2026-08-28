const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const {
    pool
} = require("../db");

const {
    chat,
    DEFAULT_MODEL,
    MOCK_MODE
} = require("../openrouter");

// ============================================================
// TEST / QWEN
// ============================================================

router.post(
    "/test",
    async (req, res) => {

        try {

            const {
                email,
                model,
                messages
            } = req.body || {};

            // ------------------------------------------------
            // EMPLOYEE
            // ------------------------------------------------

            let employee = null;

            if (email) {

                const result =
                    await pool.query(
                        `
                        SELECT
                            id,
                            email,
                            department,
                            role
                        FROM employees
                        WHERE LOWER(email) =
                              LOWER($1)
                        `,
                        [email]
                    );

                employee =
                    result.rows[0];
            }

            // ------------------------------------------------
            // DEFAULT EMPLOYEE
            // ------------------------------------------------

            if (!employee) {

                const result =
                    await pool.query(
                        `
                        SELECT
                            id,
                            email,
                            department,
                            role
                        FROM employees
                        ORDER BY id
                        LIMIT 1
                        `
                    );

                employee =
                    result.rows[0];
            }

            if (!employee) {

                return res.status(404).json({

                    success: false,

                    error:
                        "No employee exists in PostgreSQL"
                });
            }

            // ------------------------------------------------
            // MESSAGE
            // ------------------------------------------------

            const requestMessages =
                Array.isArray(messages) &&
                messages.length > 0

                    ? messages

                    : [
                        {
                            role: "user",
                            content:
                                "Say hello and nothing else."
                        }
                    ];

            // ------------------------------------------------
            // IDS
            // ------------------------------------------------

            const interactionId =
                crypto.randomUUID();

            const sessionId =
                crypto.randomUUID();

            // ------------------------------------------------
            // AI
            // ------------------------------------------------

            const ai =
                await chat({

                    model:
                        model ||
                        DEFAULT_MODEL,

                    messages:
                        requestMessages
                });

            // ------------------------------------------------
            // STORE
            // ------------------------------------------------

            const result =
                await pool.query(
                    `
                    INSERT INTO usage_events
                    (
                        employee_id,
                        provider,
                        product,
                        event_type,
                        session_id,
                        interaction_id,
                        model,
                        occurred_at,
                        latency_ms,
                        prompt_length,
                        response_length,
                        prompt_tokens,
                        response_tokens,
                        total_tokens,
                        metadata,
                        input_cost_usd,
                        output_cost_usd,
                        total_cost_usd,
                        currency
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        NOW(),
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        $13,
                        $14,
                        $15,
                        $16,
                        $17,
                        $18
                    )
                    RETURNING id
                    `,
                    [

                        employee.id,

                        "openrouter",

                        "qwen",

                        "interaction_completed",

                        sessionId,

                        interactionId,

                        ai.model,

                        ai.latency_ms,

                        requestMessages
                            .map(m =>
                                typeof m.content === "string"
                                    ? m.content
                                    : ""
                            )
                            .join("\n")
                            .length,

                        ai.response?.content
                            ? ai.response.content.length
                            : 0,

                        ai.usage.prompt_tokens,

                        ai.usage.completion_tokens,

                        ai.usage.total_tokens,

                        JSON.stringify(
                            ai.metadata || {}
                        ),

                        ai.usage.input_cost_usd,

                        ai.usage.output_cost_usd,

                        ai.usage.cost_usd,

                        "USD"
                    ]
                );

            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            return res.json({

                success: true,

                mock:
                    ai.mock,

                provider:
                    ai.provider,

                product:
                    ai.product,

                model:
                    ai.model,

                response:
                    ai.response,

                usage:
                    ai.usage,

                latency_ms:
                    ai.latency_ms,

                interaction_id:
                    interactionId,

                session_id:
                    sessionId,

                event_id:
                    result.rows[0].id,

                employee: {

                    id:
                        employee.id,

                    email:
                        employee.email,

                    department:
                        employee.department,

                    role:
                        employee.role
                },

                metadata: {

                    ...ai.metadata,

                    database:
                        "postgresql"
                }
            });

        } catch (error) {

            console.error(
                "[ai-obs] QWEN TEST ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// ============================================================
// USAGE EVENTS
// ============================================================

router.get(
    "/events",
    async (req, res) => {

        try {

            let limit =
                Number(req.query.limit) || 100;

            limit =
                Math.max(
                    1,
                    Math.min(
                        limit,
                        1000
                    )
                );

            const result =
                await pool.query(
                    `
                    SELECT

                        u.id,

                        e.email,

                        e.department,

                        e.role,

                        u.provider,

                        u.product,

                        u.event_type,

                        u.session_id,

                        u.interaction_id,

                        u.model,

                        u.occurred_at,

                        u.latency_ms,

                        u.prompt_length,

                        u.response_length,

                        u.prompt_tokens,

                        u.response_tokens,

                        u.total_tokens,

                        u.input_cost_usd,

                        u.output_cost_usd,

                        u.total_cost_usd,

                        u.currency,

                        u.metadata

                    FROM usage_events u

                    LEFT JOIN employees e
                        ON e.id =
                           u.employee_id

                    ORDER BY
                        u.id DESC

                    LIMIT $1
                    `,
                    [limit]
                );

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "[ai-obs] EVENTS ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "events_query_failed"
            });
        }
    }
);

// ============================================================
// SUMMARY
// ============================================================

router.get(
    "/summary",
    async (_req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        COUNT(*) FILTER (
                            WHERE event_type =
                            'interaction_completed'
                        ) AS interactions,

                        COUNT(
                            DISTINCT employee_id
                        ) AS active_employees,

                        COUNT(
                            DISTINCT session_id
                        ) AS sessions,

                        ROUND(
                            AVG(latency_ms)
                        ) AS avg_latency_ms,

                        COALESCE(
                            SUM(prompt_tokens),
                            0
                        ) AS prompt_tokens,

                        COALESCE(
                            SUM(response_tokens),
                            0
                        ) AS response_tokens,

                        COALESCE(
                            SUM(total_tokens),
                            0
                        ) AS total_tokens,

                        COALESCE(
                            SUM(total_cost_usd),
                            0
                        ) AS total_cost_usd

                    FROM usage_events
                    `
                );

            res.json(
                result.rows[0]
            );

        } catch (error) {

            console.error(
                "[ai-obs] SUMMARY ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "summary_failed"
            });
        }
    }
);

// ============================================================
// BY PROVIDER
// ============================================================

router.get(
    "/by-provider",
    async (_req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        provider,

                        COUNT(*) FILTER (
                            WHERE event_type =
                            'interaction_completed'
                        ) AS interactions,

                        COUNT(
                            DISTINCT employee_id
                        ) AS active_employees,

                        COUNT(
                            DISTINCT session_id
                        ) AS sessions,

                        ROUND(
                            AVG(latency_ms)
                        ) AS avg_latency_ms,

                        COALESCE(
                            SUM(prompt_tokens),
                            0
                        ) AS prompt_tokens,

                        COALESCE(
                            SUM(response_tokens),
                            0
                        ) AS response_tokens,

                        COALESCE(
                            SUM(total_tokens),
                            0
                        ) AS total_tokens,

                        COALESCE(
                            SUM(total_cost_usd),
                            0
                        ) AS total_cost_usd

                    FROM usage_events

                    GROUP BY provider

                    ORDER BY
                        interactions DESC
                    `
                );

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "[ai-obs] PROVIDER ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "provider_summary_failed"
            });
        }
    }
);

// ============================================================
// BY PRODUCT
// ============================================================

router.get(
    "/by-product",
    async (_req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        provider,

                        product,

                        COUNT(*) FILTER (
                            WHERE event_type =
                            'interaction_completed'
                        ) AS interactions,

                        COUNT(
                            DISTINCT employee_id
                        ) AS active_employees,

                        COUNT(
                            DISTINCT session_id
                        ) AS sessions,

                        ROUND(
                            AVG(latency_ms)
                        ) AS avg_latency_ms,

                        COALESCE(
                            SUM(prompt_tokens),
                            0
                        ) AS prompt_tokens,

                        COALESCE(
                            SUM(response_tokens),
                            0
                        ) AS response_tokens,

                        COALESCE(
                            SUM(total_tokens),
                            0
                        ) AS total_tokens,

                        COALESCE(
                            SUM(total_cost_usd),
                            0
                        ) AS total_cost_usd

                    FROM usage_events

                    GROUP BY
                        provider,
                        product

                    ORDER BY
                        interactions DESC
                    `
                );

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "[ai-obs] PRODUCT ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "product_summary_failed"
            });
        }
    }
);

// ============================================================
// BY EMPLOYEE
// ============================================================

router.get(
    "/by-employee",
    async (_req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        e.email,

                        e.department,

                        COUNT(u.id) FILTER (
                            WHERE u.event_type =
                            'interaction_completed'
                        ) AS interactions,

                        COUNT(
                            DISTINCT u.session_id
                        ) AS sessions,

                        COALESCE(
                            SUM(u.prompt_tokens),
                            0
                        ) AS prompt_tokens,

                        COALESCE(
                            SUM(u.response_tokens),
                            0
                        ) AS response_tokens,

                        COALESCE(
                            SUM(u.total_tokens),
                            0
                        ) AS total_tokens,

                        COALESCE(
                            SUM(u.total_cost_usd),
                            0
                        ) AS total_cost_usd,

                        ROUND(
                            AVG(u.latency_ms)
                        ) AS avg_latency_ms

                    FROM employees e

                    LEFT JOIN usage_events u
                        ON u.employee_id =
                           e.id

                    GROUP BY

                        e.id,
                        e.email,
                        e.department

                    ORDER BY
                        interactions DESC
                    `
                );

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "[ai-obs] EMPLOYEE ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "employee_summary_failed"
            });
        }
    }
);


// ============================================================
// BY EMPLOYEE × PRODUCT
// ============================================================

router.get(
    "/by-employee-product",
    async (_req, res) => {
        try {
            const result = await pool.query(
                `
                SELECT
                    e.email,
                    e.department,
                    u.provider,
                    u.product,

                    COUNT(u.id) FILTER (
                        WHERE u.event_type =
                        'interaction_completed'
                    ) AS interactions,

                    COUNT(
                        DISTINCT u.session_id
                    ) AS sessions,

                    COALESCE(
                        SUM(u.prompt_tokens),
                        0
                    ) AS prompt_tokens,

                    COALESCE(
                        SUM(u.response_tokens),
                        0
                    ) AS response_tokens,

                    COALESCE(
                        SUM(u.total_tokens),
                        0
                    ) AS total_tokens,

                    COALESCE(
                        SUM(u.total_cost_usd),
                        0
                    ) AS total_cost_usd,

                    ROUND(
                        AVG(u.latency_ms)
                    ) AS avg_latency_ms

                FROM employees e

                LEFT JOIN usage_events u
                    ON u.employee_id = e.id

                GROUP BY
                    e.id,
                    e.email,
                    e.department,
                    u.provider,
                    u.product

                ORDER BY
                    interactions DESC
                `
            );

            res.json(result.rows);

        } catch (error) {
            console.error(
                "[ai-obs] EMPLOYEE PRODUCT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "employee_product_summary_failed"
            });
        }
    }
);


router.get("/recent", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                ue.id,
                e.email,
                ue.provider,
                ue.product,
                ue.model,
                ue.event_type,
                ue.session_id,
                ue.interaction_id,
                ue.occurred_at,
                ue.latency_ms,
                ue.prompt_tokens,
                ue.response_tokens,
                ue.total_tokens,
                ue.total_cost_usd
            FROM usage_events ue
            LEFT JOIN employees e
                ON ue.employee_id = e.id
            WHERE ue.event_type = 'interaction_completed'
            ORDER BY ue.occurred_at DESC
            LIMIT 10
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Recent activity error:", error);
        res.status(500).json({
            error: "Failed to load recent activity"
        });
    }
});

module.exports = router;