const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const { pool } = require("../db");
const {
    chat,
    DEFAULT_MODEL
} = require("../openrouter");

router.post("/chat", async (req, res) => {
    const start = Date.now();

    try {
        const {
            email,
            model,
            messages
        } = req.body || {};

        // ------------------------------------------------
        // VALIDATION
        // ------------------------------------------------

        if (!email) {
            return res.status(400).json({
                success: false,
                error: "email_required"
            });
        }

        if (
            !Array.isArray(messages) ||
            messages.length === 0
        ) {
            return res.status(400).json({
                success: false,
                error: "messages_required"
            });
        }

        // ------------------------------------------------
        // EMPLOYEE
        // ------------------------------------------------

        const employeeResult = await pool.query(
            `
            SELECT
                id,
                email,
                department,
                role
            FROM employees
            WHERE LOWER(email) = LOWER($1)
            `,
            [email]
        );

        const employee = employeeResult.rows[0];

        if (!employee) {
            return res.status(404).json({
                success: false,
                error: "employee_not_found"
            });
        }

        // ------------------------------------------------
        // IDS
        // ------------------------------------------------

        const interactionId =
            crypto.randomUUID();

        const sessionId =
            req.body.session_id ||
            crypto.randomUUID();

        // ------------------------------------------------
        // AI
        // ------------------------------------------------

        const ai = await chat({
            model: model || DEFAULT_MODEL,
            messages
        });

        // ------------------------------------------------
        // STORE USAGE
        // ------------------------------------------------

        const promptLength = messages
            .map(message =>
                typeof message.content === "string"
                    ? message.content
                    : ""
            )
            .join("\n")
            .length;

        const responseLength =
            ai.response?.content?.length || 0;

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
            `,
            [
                employee.id,
                ai.provider,
                ai.product,
                "interaction_completed",
                sessionId,
                interactionId,
                ai.model,
                ai.latency_ms || Date.now() - start,
                promptLength,
                responseLength,
                ai.usage.prompt_tokens,
                ai.usage.completion_tokens,
                ai.usage.total_tokens,
                JSON.stringify(ai.metadata || {}),
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

            response: ai.response,

            provider: ai.provider,
            product: ai.product,
            model: ai.model,

            usage: ai.usage,

            latency_ms: ai.latency_ms,

            interaction_id: interactionId,
            session_id: sessionId,

            employee: {
                id: employee.id,
                email: employee.email,
                department: employee.department,
                role: employee.role
            },

            mock: ai.mock
        });

    } catch (error) {

        console.error(
            "[ai-obs] AI CHAT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;