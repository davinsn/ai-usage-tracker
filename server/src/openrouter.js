require("dotenv").config();

const OPENROUTER_BASE_URL =
    "https://openrouter.ai/api/v1";

const OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || "";

const DEFAULT_MODEL =
    process.env.OPENROUTER_DEFAULT_MODEL ||
    "qwen/qwen3-235b-a22b";

const MOCK_MODE =
    String(process.env.MOCK_MODE).toLowerCase() === "true";

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function chat({
    model,
    messages
}) {

    const selectedModel =
        model || DEFAULT_MODEL;

    // ========================================================
    // MOCK QWEN
    // ========================================================

    if (MOCK_MODE) {

        const startTime = Date.now();

        // Simulate AI latency
        await sleep(800);

        const latencyMs =
            Date.now() - startTime;

        const promptText =
            messages
                .map(message =>
                    typeof message?.content === "string"
                        ? message.content
                        : ""
                )
                .join("\n");

        // Simple deterministic mock token estimation
        const promptTokens = Math.max(
            1,
            Math.ceil(promptText.length / 4)
        );

        const completionTokens = 9;

        const totalTokens =
            promptTokens +
            completionTokens;

        // Mock Qwen cost
        const inputCost =
            promptTokens * 0.0000001;

        const outputCost =
            completionTokens * 0.0000004;

        const totalCost =
            inputCost +
            outputCost;

        return {

            mock: true,

            provider: "openrouter",

            product: "qwen",

            model: selectedModel,

            response: {

                role: "assistant",

                content:
                    "Hello! This is a mock Qwen response."
            },

            usage: {

                prompt_tokens:
                    promptTokens,

                completion_tokens:
                    completionTokens,

                total_tokens:
                    totalTokens,

                cost_usd:
                    totalCost,

                input_cost_usd:
                    inputCost,

                output_cost_usd:
                    outputCost
            },

            latency_ms:
                latencyMs,

            metadata: {

                source: "mock",

                message:
                    promptText,

                simulated: true
            }
        };
    }

    // ========================================================
    // REAL OPENROUTER
    // ========================================================

    if (!OPENROUTER_API_KEY) {

        throw new Error(
            "OPENROUTER_API_KEY is not configured"
        );
    }

    const startTime =
        Date.now();

    const response =
        await fetch(
            `${OPENROUTER_BASE_URL}/chat/completions`,
            {
                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${OPENROUTER_API_KEY}`,

                    "Content-Type":
                        "application/json",

                    "X-Title":
                        "AI Observability Tracker"
                },

                body: JSON.stringify({

                    model:
                        selectedModel,

                    messages,

                    usage: {
                        include: true
                    }
                })
            }
        );

    const responseText =
        await response.text();

    if (!response.ok) {

        throw new Error(
            `OpenRouter ${response.status}: ${responseText}`
        );
    }

    const data =
        JSON.parse(responseText);

    const latencyMs =
        Date.now() - startTime;

    const usage =
        data?.usage || {};

    const promptTokens =
        Number(
            usage.prompt_tokens || 0
        );

    const completionTokens =
        Number(
            usage.completion_tokens || 0
        );

    const totalTokens =
        Number(
            usage.total_tokens ||
            promptTokens +
            completionTokens
        );

    const totalCost =
        Number(
            usage.cost || 0
        );

    const costDetails =
        usage.cost_details || {};

    const inputCost =
        Number(
            costDetails
                .upstream_inference_input_cost ||
            0
        );

    const outputCost =
        Number(
            costDetails
                .upstream_inference_output_cost ||
            0
        );

    return {

        mock: false,

        provider: "openrouter",

        product: "qwen",

        model:
            data?.model ||
            selectedModel,

        response:
            data?.choices?.[0]?.message || null,

        usage: {

            prompt_tokens:
                promptTokens,

            completion_tokens:
                completionTokens,

            total_tokens:
                totalTokens,

            cost_usd:
                totalCost,

            input_cost_usd:
                inputCost,

            output_cost_usd:
                outputCost
        },

        latency_ms:
            latencyMs,

        metadata: {

            source: "openrouter",

            openrouter_id:
                data?.id || null,

            usage,

            cost_details:
                costDetails,

            finish_reason:
                data?.choices?.[0]?.finish_reason ||
                null
        }
    };
}

module.exports = {
    chat,
    DEFAULT_MODEL,
    MOCK_MODE
};