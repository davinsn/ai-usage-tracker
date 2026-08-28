// ============================================================
// AI OBSERVABILITY - MULTI-AI DASHBOARD
// DASHBOARD.JS
// ============================================================

// ============================================================
// CHART INSTANCES
// ============================================================

let employeeInteractionChart = null;
let providerInteractionChart = null;
let providerSessionChart = null;
let employeeAiChart = null;
let latencyChart = null;
let providerTokenChart = null;
let providerCostChart = null;
let costTypeChart = null;

// ============================================================
// GLOBAL DATA
// ============================================================

let currentBnmRate = null;
let currentBnmDate = null;
let dashboardLoading = false;

// ============================================================
// DEMO MODE
// ============================================================

let demoMode = false;
let demoCostMultiplier = 1000;

// ============================================================
// AI PRODUCT CONFIGURATION
// ============================================================

const AI_PRODUCTS = {

    gemini: {
        name: 'Gemini',
        provider: 'Google',
        color: '#4285F4'
    },

    chatgpt: {
        name: 'ChatGPT',
        provider: 'OpenAI',
        color: '#10A37F'
    },

    claude: {
        name: 'Claude',
        provider: 'Anthropic',
        color: '#D97757'
    },

    copilot: {
        name: 'Copilot',
        provider: 'Microsoft',
        color: '#6366F1'
    },

    perplexity: {
        name: 'Perplexity',
        provider: 'Perplexity',
        color: '#20B8CD'
    },

    qwen: {
        name: 'Qwen',
        provider: 'OpenRouter',
        color: '#FF6A00'
    }

};

const DEFAULT_CHART_COLOR = '#64748B';

// ============================================================
// CHART OPTIONS
// ============================================================

const chartOptions = {

    responsive: true,

    maintainAspectRatio: false,

    animation: false,

    plugins: {

        legend: {
            display: true
        }

    },

    scales: {

        y: {
            beginAtZero: true
        }

    }

};

// ============================================================
// NUMBER HELPERS
// ============================================================

function safeNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}

function formatNumber(value) {

    return safeNumber(value).toLocaleString();

}

function formatUsd(value) {

    const number = safeNumber(value);

    return '$' + number.toFixed(2);

}

function formatPreciseUsd(value) {

    const number = safeNumber(value);

    if (number === 0) {
        return '$0.00';
    }

    if (number < 0.01) {
        return '$' + number.toFixed(6);
    }

    return '$' + number.toFixed(4);

}

function formatMyr(value) {

    return 'RM' + safeNumber(value).toFixed(2);

}

// ============================================================
// INTERACTION VALUE
// ============================================================

function getInteractionValue(row) {

    if (!row) {
        return 0;
    }

    const possibleValues = [

        row.interactions,
        row.interaction_count,
        row.interactionCount,
        row.count,
        row.total_interactions,
        row.totalInteractions

    ];

    for (const value of possibleValues) {

        const number = Number(value);

        if (Number.isFinite(number)) {
            return number;
        }

    }

    return 0;

}

// ============================================================
// SESSION VALUE
// ============================================================

function getSessionValue(row) {

    if (!row) {
        return 0;
    }

    const possibleValues = [

        row.sessions,
        row.session_count,
        row.sessionCount,
        row.total_sessions,
        row.totalSessions

    ];

    for (const value of possibleValues) {

        const number = Number(value);

        if (Number.isFinite(number)) {
            return number;
        }

    }

    return 0;

}

// ============================================================
// TOKEN VALUE
// ============================================================

function getTokenValue(row) {

    if (!row) {
        return 0;
    }

    const total = Number(
        row.total_tokens ??
        row.estimated_tokens ??
        row.tokens ??
        0
    );

    if (Number.isFinite(total)) {
        return total;
    }

    return 0;

}

// ============================================================
// PROMPT TOKENS
// ============================================================

function getPromptTokens(row) {

    if (!row) {
        return 0;
    }

    return safeNumber(
        row.prompt_tokens ??
        row.input_tokens ??
        row.promptTokens ??
        0
    );

}

// ============================================================
// RESPONSE TOKENS
// ============================================================

function getResponseTokens(row) {

    if (!row) {
        return 0;
    }

    return safeNumber(
        row.response_tokens ??
        row.completion_tokens ??
        row.output_tokens ??
        row.responseTokens ??
        0
    );

}

// ============================================================
// COST
// ============================================================

function getRowCost(row) {

    if (!row) {
        return 0;
    }

    return safeNumber(
        row.total_cost_usd ??
        row.total_cost ??
        row.cost_usd ??
        row.cost ??
        0
    );

}

function getRowInputCost(row) {

    if (!row) {
        return 0;
    }

    return safeNumber(
        row.input_cost_usd ??
        row.input_cost ??
        0
    );

}

function getRowOutputCost(row) {

    if (!row) {
        return 0;
    }

    return safeNumber(
        row.output_cost_usd ??
        row.output_cost ??
        0
    );

}

// ============================================================
// DISPLAYED COST
// ============================================================

function getDisplayedRowCost(row) {

    const baseCost =
        getRowCost(row);

    return demoMode
        ? baseCost * demoCostMultiplier
        : baseCost;

}

// ============================================================
// TOTAL COST
// ============================================================

function calculateTotalUsdCost(rows) {

    if (!Array.isArray(rows)) {
        return 0;
    }

    return rows.reduce(
        (total, row) =>
            total + getRowCost(row),
        0
    );

}

// ============================================================
// NORMALIZE PRODUCT
// ============================================================

function normalizeAIProduct(row) {

    if (!row) {
        return null;
    }

    const rawProduct = String(
        row.product ??
        row.ai_product ??
        row.aiProduct ??
        ''
    )
        .toLowerCase()
        .trim();

    const rawProvider = String(
        row.provider ??
        ''
    )
        .toLowerCase()
        .trim();

    // Direct product match

    if (AI_PRODUCTS[rawProduct]) {
        return rawProduct;
    }

    // Product aliases

    const productAliases = {

        'chat-gpt': 'chatgpt',
        'chat_gpt': 'chatgpt',
        'openai-chatgpt': 'chatgpt',

        'google-gemini': 'gemini',

        'anthropic-claude': 'claude',

        'microsoft-copilot': 'copilot',

        'perplexity-ai': 'perplexity',

        'openrouter-qwen': 'qwen',

        'alibaba-qwen': 'qwen'

    };

    if (productAliases[rawProduct]) {
        return productAliases[rawProduct];
    }

    // Provider fallback

    const providerToProduct = {

        openai: 'chatgpt',

        google: 'gemini',

        anthropic: 'claude',

        microsoft: 'copilot',

        perplexity: 'perplexity',

        alibaba: 'qwen',

        qwen: 'qwen',

        openrouter: 'qwen'

    };

    return providerToProduct[rawProvider] || null;

}

// ============================================================
// PRODUCT NAME
// ============================================================

function formatProductName(product) {

    if (!product) {
        return 'Unknown';
    }

    const key =
        String(product)
            .toLowerCase()
            .trim();

    if (AI_PRODUCTS[key]) {
        return AI_PRODUCTS[key].name;
    }

    return key.charAt(0).toUpperCase() +
        key.slice(1);

}

// ============================================================
// PROVIDER NAME
// ============================================================

function formatProviderName(provider) {

    if (!provider) {
        return 'Unknown';
    }

    const key =
        String(provider)
            .toLowerCase()
            .trim();

    const providerNames = {

        google: 'Google',

        openai: 'OpenAI',

        anthropic: 'Anthropic',

        microsoft: 'Microsoft',

        perplexity: 'Perplexity',

        alibaba: 'Alibaba',

        qwen: 'Qwen',

        openrouter: 'OpenRouter'

    };

    return providerNames[key] ||
        formatProductName(key);

}

// ============================================================
// PRODUCT COLOUR
// ============================================================

function getProductColor(product) {

    const key =
        String(product || '')
            .toLowerCase()
            .trim();

    return AI_PRODUCTS[key]?.color ||
        DEFAULT_CHART_COLOR;

}

// ============================================================
// COST BREAKDOWN
// ============================================================

function calculateCostBreakdown(rows) {

    const breakdown = {};

    Object.keys(AI_PRODUCTS).forEach(product => {

        breakdown[product] = {

            product,

            name:
                AI_PRODUCTS[product].name,

            provider:
                AI_PRODUCTS[product].provider,

            color:
                AI_PRODUCTS[product].color,

            usd: 0,

            baseUsd: 0,

            myr: 0,

            interactions: 0,

            promptTokens: 0,

            responseTokens: 0,

            totalTokens: 0

        };

    });

    if (!Array.isArray(rows)) {
        return breakdown;
    }

    rows.forEach(row => {

        const product =
            normalizeAIProduct(row);

        if (!product) {

            console.warn(
                '[ai-obs] Unknown AI product:',
                row
            );

            return;

        }

        const baseCost =
            getRowCost(row);

        const displayedCost =
            getDisplayedRowCost(row);

        breakdown[product].baseUsd +=
            baseCost;

        breakdown[product].usd +=
            displayedCost;

        breakdown[product].interactions +=
            getInteractionValue(row);

        breakdown[product].promptTokens +=
            getPromptTokens(row);

        breakdown[product].responseTokens +=
            getResponseTokens(row);

        breakdown[product].totalTokens +=
            getTokenValue(row);

    });

    Object.values(breakdown).forEach(item => {

        if (
            currentBnmRate !== null &&
            Number.isFinite(currentBnmRate)
        ) {

            item.myr =
                item.usd *
                currentBnmRate;

        }

    });

    return breakdown;

}

// ============================================================
// BNM EXCHANGE RATE
//
// This is the single source of truth for the USD -> MYR rate.
// It fetches the rate, stores it in currentBnmRate/currentBnmDate,
// and refreshes every element that depends on it (rate KPI +
// cost-in-MYR figures). Nothing else in this app should fetch
// /api/exchange-rate directly.
// ============================================================

async function loadBnmExchangeRate() {
    try {
        const response = await fetch(
            "/api/exchange-rate",
            {
                cache: "no-store"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                `BNM request failed (${response.status})`
            );
        }

        /*
         * Support both:
         *
         * data.rate
         * data.middle_rate
         */
        const rate = Number(
            data.rate ??
            data.middle_rate
        );

        if (
            !Number.isFinite(rate) ||
            rate <= 0
        ) {
            throw new Error(
                "Invalid USD/MYR exchange rate"
            );
        }

        currentBnmRate = rate;
        currentBnmDate = data.date ?? null;

        console.log(
            `[dashboard] BNM USD/MYR: ${currentBnmRate}`
        );

    } catch (error) {

        console.error(
            "[dashboard] BNM rate error:",
            error
        );

        currentBnmRate = null;
        currentBnmDate = null;
    }

    updateExchangeRateDisplay();

    // The MYR cost figures depend on currentBnmRate, so refresh
    // them any time the rate changes (e.g. on the 15-minute timer),
    // not just right after loadDashboard() runs.
    updateCostDisplay(window.__lastCostRows || []);

    return currentBnmRate;
}


// ============================================================
// EXCHANGE RATE DISPLAY
// ============================================================

function updateExchangeRateDisplay() {

    const rateElement =
        document.getElementById(
            'usdMyrRate'
        );

    const descriptionElement =
        document.getElementById(
            'usdMyrDescription'
        );

    const hasRate =
        currentBnmRate !== null &&
        Number.isFinite(currentBnmRate);

    if (rateElement) {

        rateElement.textContent =
            hasRate
                ? formatMyr(currentBnmRate)
                : 'Unavailable';

    }

    if (descriptionElement) {

        descriptionElement.textContent =
            hasRate
                ? (
                    currentBnmDate
                        ? `1 USD = ${formatMyr(currentBnmRate)} • BNM • ${currentBnmDate}`
                        : `1 USD = ${formatMyr(currentBnmRate)} • BNM`
                )
                : 'BNM exchange rate unavailable';

    }

}

// ============================================================
// COST DISPLAY (USD + MYR)
// ============================================================

function updateCostDisplay(rows) {

    // Remember the rows so the BNM refresh timer can recompute
    // the MYR figure without needing a fresh /api/usage call.
    window.__lastCostRows = rows;

    const actualUsd =
        calculateTotalUsdCost(rows);

    const displayedUsd =
        demoMode
            ? actualUsd * demoCostMultiplier
            : actualUsd;

    const hasRate =
        currentBnmRate !== null &&
        Number.isFinite(currentBnmRate);

    const myr =
        hasRate
            ? displayedUsd * currentBnmRate
            : null;

    const usdElement =
        document.getElementById(
            'totalCost'
        );

    if (usdElement) {

        usdElement.textContent =
            formatPreciseUsd(displayedUsd);

    }

    const myrElement =
        document.getElementById(
            'totalCostMyr'
        );

    if (myrElement) {

        myrElement.textContent =
            hasRate
                ? formatMyr(myr)
                : 'Unavailable';

    }

    const myrDescriptionElement =
        document.getElementById(
            'totalCostMyrDescription'
        );

    if (myrDescriptionElement) {

        myrDescriptionElement.textContent =
            hasRate
                ? `${formatPreciseUsd(displayedUsd)} × ${currentBnmRate.toFixed(4)}`
                : 'Currency conversion unavailable';

    }

}

// ============================================================
// COST BY AI PLATFORM
// ============================================================

function updateProviderCostChart(rows) {

    const canvas =
        document.getElementById(
            'providerCostChart'
        );

    if (!canvas || !Array.isArray(rows)) {
        return;
    }

    const breakdown =
        calculateCostBreakdown(rows);

    const items =
        Object.values(breakdown)
            .filter(item =>
                item.usd > 0 ||
                item.interactions > 0 ||
                item.totalTokens > 0
            );

    const labels =
        items.map(item => item.name);

    const costs =
        items.map(item => item.usd);

    const colors =
        items.map(item => item.color);

    if (!providerCostChart) {

        providerCostChart =
            new Chart(
                canvas,
                {

                    type: 'bar',

                    data: {

                        labels,

                        datasets: [{

                            label:
                                demoMode
                                    ? 'Demo Cost (USD)'
                                    : 'Actual OpenRouter Cost (USD)',

                            data: costs,

                            backgroundColor: colors,

                            borderColor: colors,

                            borderWidth: 1

                        }]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio: false,

                        animation: false,

                        plugins: {

                            legend: {
                                display: false
                            },

                            tooltip: {

                                callbacks: {

                                    label: context =>
                                        (
                                            demoMode
                                                ? 'Demo Cost: '
                                                : 'Actual Cost: '
                                        ) +
                                        formatPreciseUsd(
                                            context.raw
                                        )

                                }

                            }

                        },

                        scales: {

                            y: {

                                beginAtZero: true,

                                ticks: {

                                    callback: value =>
                                        '$' +
                                        Number(value)
                                            .toFixed(4)

                                }

                            }

                        }

                    }

                }
            );

        return;

    }

    providerCostChart.data.labels =
        labels;

    providerCostChart.data.datasets[0].data =
        costs;

    providerCostChart.data.datasets[0].backgroundColor =
        colors;

    providerCostChart.data.datasets[0].borderColor =
        colors;

    providerCostChart.data.datasets[0].label =
        demoMode
            ? 'Demo Cost (USD)'
            : 'Actual OpenRouter Cost (USD)';

    providerCostChart.update('none');

}

// ============================================================
// INPUT VS OUTPUT COST
// ============================================================

function updateCostTypeChart(rows) {

    const canvas =
        document.getElementById(
            'costTypeChart'
        );

    if (!canvas || !Array.isArray(rows)) {
        return;
    }

    let inputCost = 0;
    let outputCost = 0;

    let hasSeparateCosts = false;

    rows.forEach(row => {

        if (
            row.input_cost_usd !== undefined ||
            row.output_cost_usd !== undefined
        ) {

            hasSeparateCosts = true;

            inputCost +=
                getRowInputCost(row);

            outputCost +=
                getRowOutputCost(row);

        }

    });

    let labels;
    let data;

    if (hasSeparateCosts) {

        labels = [
            'Input Cost',
            'Output Cost'
        ];

        data = [
            inputCost,
            outputCost
        ];

    } else {

        labels = [
            'Total Cost'
        ];

        data = [
            calculateTotalUsdCost(rows)
        ];

    }

    if (demoMode) {

        data =
            data.map(
                value =>
                    value *
                    demoCostMultiplier
            );

    }

    if (!costTypeChart) {

        costTypeChart =
            new Chart(
                canvas,
                {

                    type: 'doughnut',

                    data: {

                        labels,

                        datasets: [{

                            data,

                            borderWidth: 1

                        }]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio: false,

                        plugins: {

                            legend: {
                                display: true
                            },

                            tooltip: {

                                callbacks: {

                                    label: context =>
                                        `${context.label}: ` +
                                        formatPreciseUsd(
                                            context.raw
                                        )

                                }

                            }

                        }

                    }

                }
            );

        return;

    }

    costTypeChart.data.labels =
        labels;

    costTypeChart.data.datasets[0].data =
        data;

    costTypeChart.update('none');

}

// ============================================================
// COST BREAKDOWN TABLE
// ============================================================

function updateCostBreakdown(rows) {

    const table =
        document.getElementById(
            'costBreakdownTable'
        );

    if (!table) {
        return;
    }

    const breakdown =
        calculateCostBreakdown(rows);

    const items =
        Object.values(breakdown)
            .filter(item =>
                item.usd > 0 ||
                item.interactions > 0 ||
                item.totalTokens > 0
            );

    const totalUsd =
        items.reduce(
            (sum, item) =>
                sum + item.usd,
            0
        );

    if (items.length === 0) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    style="text-align:center;"
                >
                    No cost data available
                </td>

            </tr>

        `;

        return;

    }

    let html = '';

    items.forEach(item => {

        const percentage =
            totalUsd > 0
                ? item.usd / totalUsd * 100
                : 0;

        html += `

            <tr>

                <td>

                    <div class="cost-product-name">

                        <span
                            class="cost-product-dot"
                            style="
                                background-color:
                                ${item.color};
                            "
                        ></span>

                        <strong>
                            ${item.name}
                        </strong>

                    </div>

                </td>

                <td>
                    ${formatNumber(
                        item.interactions
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.totalTokens
                    )}
                </td>

                <td>
                    ${formatPreciseUsd(
                        item.usd
                    )}
                </td>

                <td>
                    ${
                        currentBnmRate !== null
                            ? formatMyr(
                                item.usd *
                                currentBnmRate
                            )
                            : 'N/A'
                    }
                </td>

                <td>
                    ${percentage.toFixed(1)}%
                </td>

            </tr>

        `;

    });

    const totalInteractions =
        items.reduce(
            (sum, item) =>
                sum + item.interactions,
            0
        );

    const totalTokens =
        items.reduce(
            (sum, item) =>
                sum + item.totalTokens,
            0
        );

    html += `

        <tr>

            <td>
                <strong>Total</strong>
            </td>

            <td>
                ${formatNumber(
                    totalInteractions
                )}
            </td>

            <td>
                ${formatNumber(
                    totalTokens
                )}
            </td>

            <td>
                <strong>
                    ${formatPreciseUsd(
                        totalUsd
                    )}
                </strong>
            </td>

            <td>

                <strong>

                    ${
                        currentBnmRate !== null
                            ? formatMyr(
                                totalUsd *
                                currentBnmRate
                            )
                            : 'N/A'
                    }

                </strong>

            </td>

            <td>
                <strong>100%</strong>
            </td>

        </tr>

    `;

    table.innerHTML = html;

}

// ============================================================
// RECENT ACTIVITY
// ============================================================

function updateRecentActivity(activity) {

    const table =
        document.getElementById(
            'recentActivityTable'
        );

    if (!table) {
        return;
    }

    if (
        !Array.isArray(activity) ||
        activity.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    style="text-align:center;"
                >
                    No recent AI activity
                </td>

            </tr>

        `;

        return;

    }

    table.innerHTML = '';

    activity.forEach(row => {

        const tr =
            document.createElement('tr');

        const date =
            row.occurred_at
                ? new Date(
                    row.occurred_at
                ).toLocaleString()
                : '-';

        const provider =
            formatProviderName(
                row.provider
            );

        const tokens =
            getTokenValue(row);

        const cost =
            getDisplayedRowCost(row);

        tr.innerHTML = `

            <td>
                ${row.email || '-'}
            </td>

            <td>
                ${provider}
            </td>

            <td>
                ${row.model || '-'}
            </td>

            <td>
                ${
                    row.latency_ms != null
                        ? `${safeNumber(
                            row.latency_ms
                        ).toFixed(0)} ms`
                        : '-'
                }
            </td>

            <td>
                ${formatNumber(tokens)}
            </td>

            <td>
                ${formatPreciseUsd(cost)}
            </td>

            <td>
                ${date}
            </td>

        `;

        table.appendChild(tr);

    });

}

// ============================================================
// DEMO MODE
// ============================================================

function initializeDemoMode() {

    const toggle =
        document.getElementById(
            'demoModeToggle'
        );

    const multiplier =
        document.getElementById(
            'demoCostMultiplier'
        );

    if (multiplier) {

        multiplier.value =
            String(demoCostMultiplier);

        multiplier.addEventListener(
            'change',
            () => {

                const value =
                    Number(
                        multiplier.value
                    );

                demoCostMultiplier =
                    Number.isFinite(value) &&
                    value > 0
                        ? value
                        : 1;

                loadDashboard();

            }
        );

    }

    if (!toggle) {
        return;
    }

    toggle.checked =
        demoMode;

    toggle.addEventListener(
        'change',
        () => {

            demoMode =
                toggle.checked;

            loadDashboard();

        }
    );

}

// ============================================================
// EMPLOYEE INTERACTION CHART
// ============================================================

function updateEmployeeCharts(employees) {

    if (!Array.isArray(employees)) {
        return;
    }

    const canvas =
        document.getElementById(
            'employeeInteractionChart'
        );

    if (!canvas) {
        return;
    }

    const labels =
        employees.map(
            employee =>
                employee.email ||
                employee.employee_email ||
                'Unknown'
        );

    const interactions =
        employees.map(
            employee =>
                getInteractionValue(employee)
        );

    if (employeeInteractionChart) {

        employeeInteractionChart.data.labels =
            labels;

        employeeInteractionChart.data.datasets[0].data =
            interactions;

        employeeInteractionChart.update('none');

        return;

    }

    employeeInteractionChart =
        new Chart(
            canvas,
            {

                type: 'bar',

                data: {

                    labels,

                    datasets: [{

                        label: 'Interactions',

                        data: interactions,

                        backgroundColor:
                            '#6366F1',

                        borderColor:
                            '#6366F1',

                        borderWidth: 1

                    }]

                },

                options: chartOptions

            }
        );

}

// ============================================================
// PROVIDER CHARTS
// ============================================================

function updateProviderCharts(providers) {

    if (!Array.isArray(providers)) {
        return;
    }

    const labels =
        providers.map(
            row =>
                formatProviderName(
                    row.provider
                )
        );

    const interactions =
        providers.map(
            row =>
                getInteractionValue(row)
        );

    const sessions =
        providers.map(
            row =>
                getSessionValue(row)
        );

    const latency =
        providers.map(
            row =>
                safeNumber(
                    row.avg_latency_ms ??
                    row.average_latency_ms
                )
        );

    const colors =
        providers.map(
            row => {

                const provider =
                    String(
                        row.provider || ''
                    )
                        .toLowerCase()
                        .trim();

                const product =
                    normalizeAIProduct(row);

                const providerColors = {

                    google: '#4285F4',

                    openai: '#10A37F',

                    anthropic: '#D97757',

                    microsoft: '#6366F1',

                    perplexity: '#20B8CD',

                    alibaba: '#FF6A00',

                    qwen: '#FF6A00',

                    openrouter: '#64748B'

                };

                return providerColors[provider] ||
                    getProductColor(product);

            }
        );

    // ========================================================
    // PROVIDER INTERACTIONS
    // ========================================================

    const interactionCanvas =
        document.getElementById(
            'providerInteractionChart'
        );

    if (interactionCanvas) {

        if (providerInteractionChart) {

            providerInteractionChart.data.labels =
                labels;

            providerInteractionChart.data.datasets[0].data =
                interactions;

            providerInteractionChart.data.datasets[0].backgroundColor =
                colors;

            providerInteractionChart.data.datasets[0].borderColor =
                colors;

            providerInteractionChart.update('none');

        } else {

            providerInteractionChart =
                new Chart(
                    interactionCanvas,
                    {

                        type: 'bar',

                        data: {

                            labels,

                            datasets: [{

                                label:
                                    'Interactions',

                                data:
                                    interactions,

                                backgroundColor:
                                    colors,

                                borderColor:
                                    colors,

                                borderWidth: 1

                            }]

                        },

                        options:
                            chartOptions

                    }
                );

        }

    }

    // ========================================================
    // PROVIDER SESSIONS
    // ========================================================

    const sessionCanvas =
        document.getElementById(
            'providerSessionChart'
        );

    if (sessionCanvas) {

        if (providerSessionChart) {

            providerSessionChart.data.labels =
                labels;

            providerSessionChart.data.datasets[0].data =
                sessions;

            providerSessionChart.data.datasets[0].backgroundColor =
                colors;

            providerSessionChart.data.datasets[0].borderColor =
                colors;

            providerSessionChart.update('none');

        } else {

            providerSessionChart =
                new Chart(
                    sessionCanvas,
                    {

                        type: 'bar',

                        data: {

                            labels,

                            datasets: [{

                                label:
                                    'Sessions',

                                data:
                                    sessions,

                                backgroundColor:
                                    colors,

                                borderColor:
                                    colors,

                                borderWidth: 1

                            }]

                        },

                        options:
                            chartOptions

                    }
                );

        }

    }

    // ========================================================
    // PROVIDER LATENCY
    // ========================================================

    const latencyCanvas =
        document.getElementById(
            'latencyChart'
        );

    if (latencyCanvas) {

        if (latencyChart) {

            latencyChart.data.labels =
                labels;

            latencyChart.data.datasets[0].data =
                latency;

            latencyChart.update('none');

        } else {

            latencyChart =
                new Chart(
                    latencyCanvas,
                    {

                        type: 'line',

                        data: {

                            labels,

                            datasets: [{

                                label:
                                    'Average Latency (ms)',

                                data:
                                    latency,

                                borderWidth: 3,

                                tension: 0.3,

                                fill: false,

                                pointRadius: 5,

                                pointHoverRadius: 7

                            }]

                        },

                        options: {

                            responsive: true,

                            maintainAspectRatio: false,

                            animation: false,

                            plugins: {

                                legend: {
                                    display: true
                                },

                                tooltip: {

                                    callbacks: {

                                        label:
                                            context =>
                                                'Latency: ' +
                                                safeNumber(
                                                    context.raw
                                                ).toFixed(0) +
                                                ' ms'

                                    }

                                }

                            },

                            scales: {

                                y: {

                                    beginAtZero: true,

                                    title: {

                                        display: true,

                                        text:
                                            'Latency (ms)'

                                    }

                                },

                                x: {

                                    title: {

                                        display: true,

                                        text:
                                            'Provider'

                                    }

                                }

                            }

                        }

                    }
                );

        }

    }

}

// ============================================================
// TOKEN CHART
// ============================================================

function updateTokenChart(providers) {

    if (!Array.isArray(providers)) {
        return;
    }

    const canvas =
        document.getElementById(
            'providerTokenChart'
        );

    if (!canvas) {
        return;
    }

    const labels =
        providers.map(
            row =>
                formatProductName(
                    normalizeAIProduct(row) ||
                    row.product ||
                    row.provider
                )
        );

    const tokens =
        providers.map(
            row => {

                const total =
                    Number(
                        row.total_tokens
                    );

                if (
                    Number.isFinite(total)
                ) {

                    return total;

                }

                return (
                    getPromptTokens(row) +
                    getResponseTokens(row)
                );

            }
        );

    const products =
        providers.map(
            row =>
                normalizeAIProduct(row) ||
                row.product ||
                row.provider
        );

    const colors =
        products.map(
            product =>
                getProductColor(product)
        );

    if (providerTokenChart) {

        providerTokenChart.data.labels =
            labels;

        providerTokenChart.data.datasets[0].data =
            tokens;

        providerTokenChart.data.datasets[0].backgroundColor =
            colors;

        providerTokenChart.data.datasets[0].borderColor =
            colors;

        providerTokenChart.update('none');

        return;

    }

    providerTokenChart =
        new Chart(
            canvas,
            {

                type: 'bar',

                data: {

                    labels,

                    datasets: [{

                        label: 'Tokens',

                        data: tokens,

                        backgroundColor: colors,

                        borderColor: colors,

                        borderWidth: 1

                    }]

                },

                options: {

                    ...chartOptions,

                    plugins: {

                        ...chartOptions.plugins,

                        tooltip: {

                            callbacks: {

                                label:
                                    context =>
                                        'Tokens: ' +
                                        formatNumber(
                                            context.raw
                                        )

                            }

                        }

                    }

                }

            }
        );

}

// ============================================================
// EMPLOYEE × AI PRODUCT
// ============================================================

function updateEmployeeProductChart(employeeProducts) {

    if (!Array.isArray(employeeProducts)) {
        return;
    }

    const canvas =
        document.getElementById(
            'employeeAiChart'
        );

    if (!canvas) {
        return;
    }

    // --------------------------------------------------------
    // NORMALISE DATA FIRST
    // --------------------------------------------------------

    const normalizedRows =
        employeeProducts
            .map(row => {

                const email =
                    String(
                        row.email ??
                        row.employee_email ??
                        row.employeeEmail ??
                        ''
                    )
                        .trim();

                const product =
                    normalizeAIProduct(row);

                return {

                    email,

                    product,

                    interactions:
                        getInteractionValue(row)

                };

            })
            .filter(
                row =>
                    row.email &&
                    row.product
            );

    // --------------------------------------------------------
    // EMPLOYEES
    // --------------------------------------------------------

    const employees = [

        ...new Set(
            normalizedRows.map(
                row => row.email
            )
        )

    ];

    // --------------------------------------------------------
    // PRODUCTS
    // --------------------------------------------------------

    const products = [

        ...new Set(
            normalizedRows.map(
                row => row.product
            )
        )

    ];

    // --------------------------------------------------------
    // DATASETS
    // --------------------------------------------------------

    const datasets =
        products.map(product => {

            const color =
                getProductColor(product);

            return {

                label:
                    formatProductName(product),

                data:
                    employees.map(email => {

                        const matchingRows =
                            normalizedRows.filter(
                                row =>
                                    row.email === email &&
                                    row.product === product
                            );

                        return matchingRows.reduce(
                            (total, row) =>
                                total +
                                row.interactions,
                            0
                        );

                    }),

                backgroundColor:
                    color,

                borderColor:
                    color,

                borderWidth: 1

            };

        });

    // --------------------------------------------------------
    // CREATE / UPDATE
    // --------------------------------------------------------

    if (employeeAiChart) {

        employeeAiChart.data.labels =
            employees;

        employeeAiChart.data.datasets =
            datasets;

        employeeAiChart.update('none');

        return;

    }

    employeeAiChart =
        new Chart(
            canvas,
            {

                type: 'bar',

                data: {

                    labels:
                        employees,

                    datasets:
                        datasets

                },

                options: {

                    ...chartOptions,

                    scales: {

                        x: {

                            stacked: true

                        },

                        y: {

                            beginAtZero: true,

                            stacked: true,

                            ticks: {

                                precision: 0

                            }

                        }

                    }

                }

            }
        );

}

// ============================================================
// EMPLOYEE TABLE
// ============================================================

function updateTable(employees) {

    const table =
        document.getElementById(
            'employeeTable'
        );

    if (!table) {
        return;
    }

    table.innerHTML = '';

    if (!Array.isArray(employees)) {
        return;
    }

    employees.forEach(employee => {

        const row =
            document.createElement('tr');

        const products = {

            gemini:
                safeNumber(employee.gemini),

            chatgpt:
                safeNumber(employee.chatgpt),

            claude:
                safeNumber(employee.claude),

            copilot:
                safeNumber(employee.copilot),

            perplexity:
                safeNumber(employee.perplexity),

            qwen:
                safeNumber(employee.qwen)

        };

        const calculatedTotal =
            Object.values(products)
                .reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );

        const total =
            Number.isFinite(
                Number(employee.interactions)
            )
                ? Number(employee.interactions)
                : calculatedTotal;

        const totalTokens =
            getTokenValue(employee);

        row.innerHTML = `

            <td>
                ${employee.email || '-'}
            </td>

            <td>
                ${employee.department || '-'}
            </td>

            <td>
                ${formatNumber(products.gemini)}
            </td>

            <td>
                ${formatNumber(products.chatgpt)}
            </td>

            <td>
                ${formatNumber(products.claude)}
            </td>

            <td>
                ${formatNumber(products.copilot)}
            </td>

            <td>
                ${formatNumber(products.perplexity)}
            </td>

            <td>
                ${formatNumber(products.qwen)}
            </td>

            <td>
                ${formatNumber(total)}
            </td>

            <td>
                ${formatNumber(
                    getSessionValue(employee)
                )}
            </td>

            <td>

                ${
                    employee.avg_latency_ms != null
                        ? safeNumber(
                            employee.avg_latency_ms
                        ).toFixed(0) + ' ms'
                        : 'N/A'
                }

            </td>

            <td>
                ${formatNumber(totalTokens)}
            </td>

        `;

        table.appendChild(row);

    });

}

// ============================================================
// AI STATUS
// ============================================================

function updateAIStatus(products) {

    const status =
        document.querySelector('.status');

    if (!status || !Array.isArray(products)) {
        return;
    }

    const activeProducts =
        products.filter(
            row =>
                getInteractionValue(row) > 0
        );

    status.innerHTML = `

        <span class="status-dot"></span>

        ${activeProducts.length}

        AI

        ${
            activeProducts.length === 1
                ? 'Product'
                : 'Products'
        }

        Connected

    `;

}

// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    // Prevent overlapping 5-second refreshes.

    if (dashboardLoading) {
        return;
    }

    dashboardLoading = true;

    try {

        const responses =
            await Promise.all([

                fetch('/api/usage/summary'),

                fetch('/api/usage/by-employee'),

                fetch('/api/usage/by-provider'),

                fetch('/api/usage/by-product'),

                fetch('/api/usage/by-employee-product'),

                fetch('/api/usage/recent')

            ]);

        if (
            responses.some(
                response =>
                    !response.ok
            )
        ) {

            throw new Error(
                'One or more dashboard APIs failed'
            );

        }

        const [

            summaryResponse,
            employeeResponse,
            providerResponse,
            productResponse,
            employeeProductResponse,
            recentResponse

        ] = responses;

        const summary =
            await summaryResponse.json();

        const employees =
            await employeeResponse.json();

        const providers =
            await providerResponse.json();

        const products =
            await productResponse.json();

        const employeeProducts =
            await employeeProductResponse.json();

        const recentActivity =
            await recentResponse.json();

        // ----------------------------------------------------
        // DEBUG
        // ----------------------------------------------------

        console.log(
            '[dashboard] summary:',
            summary
        );

        console.log(
            '[dashboard] employees:',
            employees
        );

        console.log(
            '[dashboard] providers:',
            providers
        );

        console.log(
            '[dashboard] products:',
            products
        );

        console.log(
            '[dashboard] employee-product:',
            employeeProducts
        );

        console.log(
            '[dashboard] recent:',
            recentActivity
        );

        // ----------------------------------------------------
        // COST (USD + MYR)
        // ----------------------------------------------------

        updateCostDisplay(products);

        updateCostBreakdown(products);

        updateProviderCostChart(products);

        updateCostTypeChart(products);

        // ----------------------------------------------------
        // CHARTS
        // ----------------------------------------------------

        updateEmployeeCharts(employees);

        updateProviderCharts(providers);

        updateTokenChart(providers);

        updateEmployeeProductChart(
            employeeProducts
        );

        // ----------------------------------------------------
        // TABLES / STATUS
        // ----------------------------------------------------

        updateRecentActivity(
            recentActivity
        );

        updateTable(
            employees
        );

        updateAIStatus(
            products
        );

        // ----------------------------------------------------
        // KPI CARDS
        // ----------------------------------------------------

        const totalInteractions =
            document.getElementById(
                'totalInteractions'
            );

        const totalSessions =
            document.getElementById(
                'totalSessions'
            );

        const activeUsers =
            document.getElementById(
                'activeUsers'
            );

        const averageLatency =
            document.getElementById(
                'averageLatency'
            );

        const totalTokens =
            document.getElementById(
                'totalTokens'
            );

        if (totalInteractions) {

            totalInteractions.textContent =
                formatNumber(
                    summary.interactions ??
                    summary.total_interactions ??
                    0
                );

        }

        if (totalSessions) {

            totalSessions.textContent =
                formatNumber(
                    summary.sessions ??
                    summary.total_sessions ??
                    0
                );

        }

        if (activeUsers) {

            activeUsers.textContent =
                formatNumber(
                    summary.active_employees ??
                    summary.active_users ??
                    0
                );

        }

        if (averageLatency) {

            averageLatency.textContent =
                summary.avg_latency_ms != null
                    ? `${safeNumber(
                        summary.avg_latency_ms
                    ).toFixed(0)} ms`
                    : 'N/A';

        }

        if (totalTokens) {

            totalTokens.textContent =
                formatNumber(
                    getTokenValue(summary)
                );

        }

        // ----------------------------------------------------
        // LAST UPDATED
        // ----------------------------------------------------

        const lastUpdated =
            document.getElementById(
                'lastUpdated'
            );

        if (lastUpdated) {

            lastUpdated.textContent =
                new Date()
                    .toLocaleTimeString();

        }

    } catch (error) {

        console.error(
            '[dashboard] Loading failed:',
            error
        );

    } finally {

        dashboardLoading = false;

    }

}

// ============================================================
// INITIALIZE
// ============================================================

async function initializeDashboard() {

    initializeDemoMode();

    await loadBnmExchangeRate();

    await loadDashboard();

}

initializeDashboard();

// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
    loadDashboard,
    5000
);

// ============================================================
// BNM REFRESH
// ============================================================

setInterval(
    loadBnmExchangeRate,
    15 * 60 * 1000
);