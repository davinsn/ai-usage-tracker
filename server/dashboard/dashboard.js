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
let tokenTypeChart = null;
let providerCostChart = null;
let costTypeChart = null;

// ============================================================
// GLOBAL DATA
// ============================================================

let currentBnmRate = null;

// ============================================================
// DEMO MODE
// ============================================================

// Demo mode ONLY changes displayed cost.
// It does NOT change token counts, interactions,
// sessions, latency, or database values.

let demoMode = false;
let demoCostMultiplier = 1000;

// ============================================================
// AI PRODUCT CONFIGURATION
// ============================================================

// IMPORTANT:
//
// This configuration is ONLY for display names and colours.
//
// Pricing is NOT stored here.
//
// Actual cost comes from:
//
// OpenRouter
//     ↓
// Backend
//     ↓
// PostgreSQL
//     ↓
// total_cost_usd
//
// The dashboard does NOT calculate model pricing.

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

// ============================================================
// DEFAULT CHART COLOUR
// ============================================================

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
// NUMBER FORMATTER
// ============================================================

function formatNumber(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return '0';
    }

    return number.toLocaleString();

}

// ============================================================
// USD FORMATTER
// ============================================================

function formatUsd(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return '$0.00';
    }

    return '$' + number.toFixed(2);

}

// ============================================================
// PRECISE USD FORMATTER
// ============================================================

// Useful for very small OpenRouter costs.

function formatPreciseUsd(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return '$0.000000';
    }

    if (number === 0) {
        return '$0.00';
    }

    if (number < 0.01) {
        return '$' + number.toFixed(6);
    }

    return '$' + number.toFixed(4);

}

// ============================================================
// MYR FORMATTER
// ============================================================

function formatMyr(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 'RM0.00';
    }

    return 'RM' + number.toFixed(2);

}

// ============================================================
// TOKEN VALUE
// ============================================================

function getTokenValue(row) {

    if (!row) {
        return 0;
    }

    const totalTokens = Number(
        row.total_tokens ??
        row.estimated_tokens ??
        row.tokens ??
        0
    );

    if (
        Number.isFinite(totalTokens) &&
        totalTokens >= 0
    ) {
        return totalTokens;
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

    return Number(
        row.prompt_tokens ??
        row.input_tokens ??
        0
    ) || 0;

}

// ============================================================
// RESPONSE TOKENS
// ============================================================

function getResponseTokens(row) {

    if (!row) {
        return 0;
    }

    return Number(
        row.response_tokens ??
        row.completion_tokens ??
        row.output_tokens ??
        0
    ) || 0;

}

// ============================================================
// OPENROUTER TOTAL COST
// ============================================================

// IMPORTANT:
//
// The dashboard DOES NOT calculate pricing.
//
// The backend should store:
//
// input_cost_usd
// output_cost_usd
// total_cost_usd
//
// These values originate from the OpenRouter request/response
// processing performed by the backend.

function getRowCost(row) {

    if (!row) {
        return 0;
    }

    const cost = Number(
        row.total_cost_usd ??
        row.total_cost ??
        row.cost_usd ??
        0
    );

    return Number.isFinite(cost)
        ? cost
        : 0;

}

// ============================================================
// INPUT COST
// ============================================================

function getRowInputCost(row) {

    if (!row) {
        return 0;
    }

    const value = Number(
        row.input_cost_usd ??
        row.input_cost ??
        0
    );

    return Number.isFinite(value)
        ? value
        : 0;

}

// ============================================================
// OUTPUT COST
// ============================================================

function getRowOutputCost(row) {

    if (!row) {
        return 0;
    }

    const value = Number(
        row.output_cost_usd ??
        row.output_cost ??
        0
    );

    return Number.isFinite(value)
        ? value
        : 0;

}

// ============================================================
// BASE COST FOR ROW
// ============================================================

// Always represents the real cost stored by the backend.

function getBaseRowCost(row) {

    return getRowCost(row);

}

// ============================================================
// DISPLAYED COST FOR ROW
// ============================================================

function getDisplayedRowCost(row) {

    const baseCost = getBaseRowCost(row);

    if (!demoMode) {
        return baseCost;
    }

    return baseCost * demoCostMultiplier;

}

// ============================================================
// TOTAL COST
// ============================================================

function calculateTotalUsdCost(products) {

    if (!Array.isArray(products)) {
        return 0;
    }

    return products.reduce(
        (total, row) => {

            return total + getBaseRowCost(row);

        },
        0
    );

}

// ============================================================
// NORMALIZE AI PRODUCT
// ============================================================

function normalizeAIProduct(row) {

    if (!row) {
        return null;
    }

    const product = String(
        row.product ??
        row.ai_product ??
        ''
    ).toLowerCase().trim();

    const provider = String(
        row.provider ??
        ''
    ).toLowerCase().trim();

    // Product is already valid.

    if (AI_PRODUCTS[product]) {
        return product;
    }

    // Provider -> product.

    const providerToProduct = {

        openai: 'chatgpt',

        google: 'gemini',

        anthropic: 'claude',

        microsoft: 'copilot',

        perplexity: 'perplexity',

        alibaba: 'qwen',

        openrouter: 'qwen'

    };

    return providerToProduct[provider] || null;

}

// ============================================================
// COST BREAKDOWN BY AI
// ============================================================

function calculateCostBreakdown(products) {

    const breakdown = {};

    // --------------------------------------------------------
    // INITIALISE ALL CONFIGURED AI PRODUCTS
    // --------------------------------------------------------

    Object.keys(AI_PRODUCTS).forEach(product => {

        breakdown[product] = {

            product: product,

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

    // --------------------------------------------------------
    // PROCESS API ROWS
    // --------------------------------------------------------

    if (!Array.isArray(products)) {
        return breakdown;
    }

    products.forEach(row => {

        const product =
            normalizeAIProduct(row);

        if (
            !product ||
            !breakdown[product]
        ) {

            console.warn(
                '[ai-obs] COST BREAKDOWN: unknown product',
                row
            );

            return;
        }

        const promptTokens =
            getPromptTokens(row);

        const responseTokens =
            getResponseTokens(row);

        const totalTokens =
            getTokenValue(row);

        // ----------------------------------------------------
        // ACTUAL OPENROUTER COST
        // ----------------------------------------------------

        const baseCost =
            getBaseRowCost(row);

        // ----------------------------------------------------
        // DISPLAY COST
        // ----------------------------------------------------

        const cost =
            demoMode
                ? baseCost * demoCostMultiplier
                : baseCost;

        breakdown[product].usd += cost;

        breakdown[product].baseUsd +=
            baseCost;

        breakdown[product].promptTokens +=
            promptTokens;

        breakdown[product].responseTokens +=
            responseTokens;

        breakdown[product].totalTokens +=
            totalTokens;

        breakdown[product].interactions +=
            Number(row.interactions) || 0;

    });

    // --------------------------------------------------------
    // USD -> MYR
    // --------------------------------------------------------

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
// GET PRODUCT COLOUR
// ============================================================

function getProductColor(product) {

    if (!product) {
        return DEFAULT_CHART_COLOR;
    }

    const key =
        String(product).toLowerCase();

    if (AI_PRODUCTS[key]) {
        return AI_PRODUCTS[key].color;
    }

    return DEFAULT_CHART_COLOR;

}

// ============================================================
// GET PRODUCT COLOURS
// ============================================================

function getProductColors(products) {

    return products.map(
        product =>
            getProductColor(product)
    );

}

// ============================================================
// PRODUCT NAME
// ============================================================

function formatProductName(product) {

    if (!product) {
        return 'Unknown';
    }

    const key =
        String(product).toLowerCase();

    if (AI_PRODUCTS[key]) {

        return AI_PRODUCTS[key].name;

    }

    return (
        String(product)
            .charAt(0)
            .toUpperCase()
        +
        String(product)
            .slice(1)
    );

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

        openrouter: 'OpenRouter'

    };

    return (
        providerNames[key] ||
        formatProductName(key)
    );

}

// ============================================================
// LOAD BNM EXCHANGE RATE
// ============================================================

async function loadBnmExchangeRate() {

    try {

        const response =
            await fetch(
                '/api/exchange-rate/usd-myr'
            );

        if (!response.ok) {

            throw new Error(
                'BNM exchange-rate request failed'
            );

        }

        const data =
            await response.json();

        if (
            data.success &&
            Number(data.middle_rate) > 0
        ) {

            currentBnmRate =
                Number(data.middle_rate);

            updateExchangeRateDisplay();

            return currentBnmRate;

        }

        throw new Error(
            'Invalid BNM exchange-rate response'
        );

    } catch (error) {

        console.error(
            'BNM rate error:',
            error
        );

        currentBnmRate = null;

        updateExchangeRateDisplay();

        return null;

    }

}

// ============================================================
// EXCHANGE RATE DISPLAY
// ============================================================

function updateExchangeRateDisplay() {

    const rateElement =
        document.getElementById(
            'exchangeRate'
        );

    if (!rateElement) {
        return;
    }

    if (
        currentBnmRate !== null &&
        Number.isFinite(currentBnmRate)
    ) {

        rateElement.textContent =
            `1 USD = RM${currentBnmRate.toFixed(4)}`;

        return;

    }

    rateElement.textContent =
        'BNM rate unavailable';

}

// ============================================================
// UPDATE COST
// ============================================================

function updateCostDisplay(products) {

    // Actual OpenRouter cost.

    const actualUsdCost =
        calculateTotalUsdCost(products);

    // Displayed cost.

    const displayedUsdCost =
        demoMode
            ? actualUsdCost *
              demoCostMultiplier
            : actualUsdCost;

    // USD -> MYR.

    const myrCost =
        currentBnmRate !== null
            ? displayedUsdCost *
              currentBnmRate
            : null;

    // --------------------------------------------------------
    // USD
    // --------------------------------------------------------

    const usdElement =
        document.getElementById(
            'estimatedCostUsd'
        );

    if (usdElement) {

        usdElement.textContent =
            formatUsd(
                displayedUsdCost
            );

    }

    // --------------------------------------------------------
    // MYR
    // --------------------------------------------------------

    const myrElement =
        document.getElementById(
            'estimatedCostMyr'
        );

    if (myrElement) {

        myrElement.textContent =
            myrCost !== null
                ? formatMyr(myrCost)
                : 'N/A';

    }

    // --------------------------------------------------------
    // LEGACY COST ELEMENT
    // --------------------------------------------------------

    const oldCostElement =
        document.getElementById(
            'estimatedCost'
        );

    if (oldCostElement) {

        oldCostElement.textContent =
            myrCost !== null
                ? formatMyr(myrCost)
                : formatUsd(
                    displayedUsdCost
                );

    }

    // --------------------------------------------------------
    // COST LABEL
    // --------------------------------------------------------

    const costLabel =
        document.getElementById(
            'costLabel'
        );

    if (costLabel) {

        costLabel.textContent =
            demoMode
                ? 'Demo Cost'
                : 'Actual OpenRouter Cost';

    }

    return {

        actualUsd:
            actualUsdCost,

        displayedUsd:
            displayedUsdCost,

        myr:
            myrCost,

        demoMode:
            demoMode,

        multiplier:
            demoCostMultiplier

    };

}

// ============================================================
// COST BY AI PLATFORM
// ============================================================

function updateProviderCostChart(products) {

    const canvas =
        document.getElementById(
            'providerCostChart'
        );

    if (!canvas) {

        console.error(
            '[dashboard] providerCostChart canvas not found'
        );

        return;

    }

    if (!Array.isArray(products)) {

        console.warn(
            '[dashboard] Invalid products data for cost chart'
        );

        return;

    }

    const breakdown =
        calculateCostBreakdown(products);

    const items =
        Object.values(breakdown).filter(
            item =>
                item.usd > 0 ||
                item.promptTokens > 0 ||
                item.responseTokens > 0 ||
                item.interactions > 0
        );

    const labels =
        items.map(
            item => item.name
        );

    const costs =
        items.map(
            item =>
                Number(item.usd) || 0
        );

    const colors =
        items.map(
            item => item.color
        );

    // --------------------------------------------------------
    // CREATE CHART
    // --------------------------------------------------------

    if (!providerCostChart) {

        providerCostChart =
            new Chart(
                canvas,
                {

                    type: 'bar',

                    data: {

                        labels: labels,

                        datasets: [

                            {

                                label:
                                    demoMode
                                        ? 'Demo Cost (USD)'
                                        : 'Actual OpenRouter Cost (USD)',

                                data: costs,

                                backgroundColor:
                                    colors,

                                borderColor:
                                    colors,

                                borderWidth: 1

                            }

                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio: false,

                        plugins: {

                            legend: {

                                display: false

                            },

                            tooltip: {

                                callbacks: {

                                    label:
                                        function(context) {

                                            return (
                                                demoMode
                                                    ? 'Demo Cost: '
                                                    : 'Actual Cost: '
                                            ) +
                                            formatPreciseUsd(
                                                context.raw
                                            );

                                        }

                                }

                            }

                        },

                        scales: {

                            y: {

                                beginAtZero: true,

                                ticks: {

                                    callback:
                                        function(value) {

                                            return '$' +
                                                Number(value)
                                                    .toFixed(4);

                                        }

                                }

                            }

                        }

                    }

                }
            );

        return;

    }

    // --------------------------------------------------------
    // UPDATE EXISTING CHART
    // --------------------------------------------------------

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

function updateCostTypeChart(products) {

    const canvas =
        document.getElementById(
            'costTypeChart'
        );

    if (!canvas) {

        console.error(
            '[dashboard] costTypeChart canvas not found'
        );

        return;

    }

    if (!Array.isArray(products)) {

        console.warn(
            '[dashboard] Invalid products data for cost type chart'
        );

        return;

    }

    let inputCost = 0;

    let outputCost = 0;

    let hasSeparateCostData = false;

    products.forEach(row => {

        const rowInput =
            Number(row.input_cost_usd);

        const rowOutput =
            Number(row.output_cost_usd);

        // Only treat the values as separate cost data
        // if the backend actually supplied them.

        if (
            row.input_cost_usd !== undefined ||
            row.output_cost_usd !== undefined
        ) {

            if (Number.isFinite(rowInput)) {

                inputCost += rowInput;

            }

            if (Number.isFinite(rowOutput)) {

                outputCost += rowOutput;

            }

            hasSeparateCostData = true;

        }

    });

    let labels;

    let data;

    // --------------------------------------------------------
    // SEPARATE INPUT / OUTPUT COSTS
    // --------------------------------------------------------

    if (hasSeparateCostData) {

        labels = [

            'Input Cost',

            'Output Cost'

        ];

        data = [

            inputCost,

            outputCost

        ];

    }

    // --------------------------------------------------------
    // FALLBACK TO TOTAL COST
    // --------------------------------------------------------

    else {

        const totalCost =
            calculateTotalUsdCost(products);

        labels = [

            'Total Cost'

        ];

        data = [

            totalCost

        ];

    }

    // --------------------------------------------------------
    // DEMO MODE
    // --------------------------------------------------------

    if (demoMode) {

        data =
            data.map(
                value =>
                    value *
                    demoCostMultiplier
            );

    }

    // --------------------------------------------------------
    // CREATE CHART
    // --------------------------------------------------------

    if (!costTypeChart) {

        costTypeChart =
            new Chart(
                canvas,
                {

                    type: 'doughnut',

                    data: {

                        labels: labels,

                        datasets: [

                            {

                                data: data,

                                borderWidth: 1

                            }

                        ]

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

                                    label:
                                        function(context) {

                                            return (
                                                context.label +
                                                ': ' +
                                                formatPreciseUsd(
                                                    context.raw
                                                )
                                            );

                                        }

                                }

                            }

                        }

                    }

                }
            );

        return;

    }

    // --------------------------------------------------------
    // UPDATE EXISTING CHART
    // --------------------------------------------------------

    costTypeChart.data.labels =
        labels;

    costTypeChart.data.datasets[0].data =
        data;

    costTypeChart.update('none');

}

// ============================================================
// COST BREAKDOWN TABLE
// ============================================================

function updateCostBreakdown(products) {

    const table =
        document.getElementById(
            'costBreakdownTable'
        );

    if (!table) {
        return;
    }

    const breakdown =
        calculateCostBreakdown(
            products
        );

    const items =
        Object.values(breakdown).filter(
            item =>
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

    let html = '';

    // --------------------------------------------------------
    // TABLE ROWS
    // --------------------------------------------------------

    items.forEach(item => {

        const percentage =
            totalUsd > 0
                ? (
                    item.usd /
                    totalUsd
                ) * 100
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

    // --------------------------------------------------------
    // EMPTY STATE
    // --------------------------------------------------------

    if (items.length === 0) {

        html = `

            <tr>

                <td
                    colspan="6"
                    style="text-align:center;"
                >

                    No cost data available

                </td>

            </tr>

        `;

    }

    // --------------------------------------------------------
    // TOTAL
    // --------------------------------------------------------

    else {

        const totalInteractions =
            items.reduce(
                (sum, item) =>
                    sum +
                    item.interactions,
                0
            );

        const totalTokens =
            items.reduce(
                (sum, item) =>
                    sum +
                    item.totalTokens,
                0
            );

        html += `

            <tr>

                <td>

                    <strong>
                        Total
                    </strong>

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

                    <strong>
                        100%
                    </strong>

                </td>

            </tr>

        `;

    }

    table.innerHTML =
        html;

}


function updateRecentActivity(activity) {

    const table =
        document.getElementById('recentActivityTable');

    if (!table) {
        return;
    }

    table.innerHTML = '';

    if (!Array.isArray(activity) || activity.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;">
                    No recent AI activity
                </td>
            </tr>
        `;

        return;
    }

    activity.forEach(row => {
    const tr =
        document.createElement('tr');

    const date =
        row.occurred_at
            ? new Date(row.occurred_at)
                .toLocaleString()
            : '-';

    const provider =
        formatProviderName(
            row.provider
        );

    const tokens =
        Number(row.total_tokens) || 0;

    const cost =
        Number(row.total_cost_usd) || 0;

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
            ${row.latency_ms || '-'}
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
// DEMO MODE CONTROLS
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

    if (!toggle) {
        return;
    }

    toggle.checked =
        demoMode;

    if (multiplier) {

        multiplier.value =
            String(
                demoCostMultiplier
            );

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
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    try {

        const [
            summaryResponse,
            employeeResponse,
            providerResponse,
            productResponse,
            employeeProductResponse,
            recentResponse
        ] = await Promise.all([

            fetch(
                '/api/usage/summary'
            ),

            fetch(
                '/api/usage/by-employee'
            ),

            fetch(
                '/api/usage/by-provider'
            ),

            fetch(
                '/api/usage/by-product'
            ),

            fetch(
                '/api/usage/by-employee-product'
            ),

            fetch(
                '/api/usage/recent'
            )
        ]);

        if (
            !summaryResponse.ok ||
            !employeeResponse.ok ||
            !providerResponse.ok ||
            !productResponse.ok ||
            !employeeProductResponse.ok ||
            !recentResponse.ok
        ) {
            throw new Error(
                'One or more API requests failed'
            );
        }

        const summary =
            await summaryResponse.json();

        console.log("[dashboard] SUMMARY:", summary);

        console.log(
            "[dashboard] INTERACTIONS:",
            summary.interactions
        );

        console.log(
            "[dashboard] SESSIONS:",
            summary.sessions
        );

        console.log(
            "[dashboard] EMPLOYEES:",
            summary.active_employees
        );

        console.log(
            "[dashboard] TOKENS:",
            summary.total_tokens
        );


        // ============================================================
        // UPDATE KPI CARDS
        // ============================================================

        const interactionsElement =
            document.getElementById("totalInteractions");

        const sessionsElement =
            document.getElementById("totalSessions");

        const employeesElement =
            document.getElementById("activeUsers");

        const latencyElement =
            document.getElementById("averageLatency");

        const tokensElement =
            document.getElementById("totalTokens");

        const costElement =
            document.getElementById("totalCost");


        if (interactionsElement) {
            interactionsElement.textContent =
                Number(summary.interactions || 0).toLocaleString();
        }

        if (sessionsElement) {
            sessionsElement.textContent =
                Number(summary.sessions || 0).toLocaleString();
        }

        if (employeesElement) {
            employeesElement.textContent =
                Number(summary.active_employees || 0).toLocaleString();
        }

        if (latencyElement) {
            latencyElement.textContent =
                `${Math.round(
                    Number(summary.avg_latency_ms || 0)
                )} ms`;
        }

        if (tokensElement) {
            tokensElement.textContent =
                Number(summary.total_tokens || 0).toLocaleString();
        }

        if (costElement) {
            costElement.textContent =
                `$${Number(
                    summary.total_cost_usd || 0
                ).toFixed(6)}`;
        }

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
        // UPDATE DASHBOARD
        // ----------------------------------------------------

        updateMetrics(
            summary
        );

        updateCostDisplay(
            products
        );

        updateCostBreakdown(
            products
        );

        updateProviderCostChart(
            products
        );

        updateCostTypeChart(
            products
        );

        updateEmployeeCharts(
            employees
        );

        updateProviderCharts(
            providers
        );

        updateTokenChart(
            providers
        );

        updateEmployeeProductChart(
            employeeProducts
        );

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
            'Dashboard loading failed:',
            error
        );

    }
}

// ============================================================
// KPI METRICS
// ============================================================

function updateMetrics(summary) {

    if (!summary) {
        return;
    }

    // --------------------------------------------------------
    // INTERACTIONS
    // --------------------------------------------------------

    const interactions =
        document.getElementById(
            'interactions'
        );

    if (interactions) {

        interactions.textContent =
            formatNumber(
                summary.interactions
            );

    }

    // --------------------------------------------------------
    // SESSIONS
    // --------------------------------------------------------

    const sessions =
        document.getElementById(
            'sessions'
        );

    if (sessions) {

        sessions.textContent =
            formatNumber(
                summary.sessions
            );

    }

    // --------------------------------------------------------
    // ACTIVE EMPLOYEES
    // --------------------------------------------------------

    const employees =
        document.getElementById(
            'employees'
        );

    if (employees) {

        employees.textContent =
            formatNumber(
                summary.active_employees
            );

    }

    // --------------------------------------------------------
    // LATENCY
    // --------------------------------------------------------

    const latency =
        document.getElementById(
            'latency'
        );

    if (latency) {

        latency.textContent =
            summary.avg_latency_ms != null

                ? `${Number(
                    summary.avg_latency_ms
                ).toFixed(0)} ms`

                : 'N/A';

    }

    // --------------------------------------------------------
    // TOKENS
    // --------------------------------------------------------

    const tokens =
        document.getElementById(
            'tokens'
        );

    if (tokens) {

        tokens.textContent =
            formatNumber(
                getTokenValue(
                    summary
                )
            );

    }

}

// ============================================================
// EMPLOYEE INTERACTIONS
// ============================================================

function updateEmployeeCharts(employees) {

    if (!Array.isArray(employees)) {
        return;
    }

    const labels =
        employees.map(
            employee =>
                employee.email ||
                'Unknown'
        );

    const interactions =
        employees.map(
            employee =>
                Number(
                    employee.interactions
                ) || 0
        );

    const canvas =
        document.getElementById(
            'employeeInteractionChart'
        );

    if (!canvas) {
        return;
    }

    if (employeeInteractionChart) {

        employeeInteractionChart.data.labels =
            labels;

        employeeInteractionChart.data.datasets[0].data =
            interactions;

        employeeInteractionChart.update(
            'none'
        );

        return;

    }

    employeeInteractionChart =
        new Chart(
            canvas,
            {

                type: 'bar',

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                'Interactions',

                            data:
                                interactions,

                            backgroundColor:
                                '#6366F1',

                            borderColor:
                                '#6366F1',

                            borderWidth: 1

                        }

                    ]

                },

                options:
                    chartOptions

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

    // --------------------------------------------------------
    // PROVIDER NAMES
    // --------------------------------------------------------

    const labels =
        providers.map(
            provider =>
                formatProviderName(
                    provider.provider
                )
        );

    // --------------------------------------------------------
    // INTERACTIONS
    // --------------------------------------------------------

    const interactions =
        providers.map(
            provider =>
                Number(
                    provider.interactions
                ) || 0
        );

    // --------------------------------------------------------
    // SESSIONS
    // --------------------------------------------------------

    const sessions =
        providers.map(
            provider =>
                Number(
                    provider.sessions
                ) || 0
        );

    // --------------------------------------------------------
    // LATENCY
    // --------------------------------------------------------

    const latency =
        providers.map(
            provider =>
                Number(
                    provider.avg_latency_ms
                ) || 0
        );

    // --------------------------------------------------------
    // TOKEN COUNT
    // --------------------------------------------------------

    const tokens =
        providers.map(
            provider => {

                const total =
                    Number(
                        provider.total_tokens
                    );

                if (
                    Number.isFinite(total) &&
                    total > 0
                ) {

                    return total;

                }

                return (

                    Number(
                        provider.prompt_tokens
                    ) || 0

                ) + (

                    Number(
                        provider.response_tokens
                    ) || 0

                );

            }
        );

    // --------------------------------------------------------
    // PROVIDER COLOURS
    // --------------------------------------------------------

    const colors =
        providers.map(
            provider => {

                const name =
                    String(
                        provider.provider || ''
                    ).toLowerCase();

                const providerColors = {

                    google:
                        '#4285F4',

                    openai:
                        '#10A37F',

                    anthropic:
                        '#D97757',

                    microsoft:
                        '#6366F1',

                    perplexity:
                        '#20B8CD',

                    alibaba:
                        '#FF6A00',

                    qwen:
                        '#FF6A00',

                    openrouter:
                        '#64748B'

                };

                return (

                    providerColors[name] ||
                    DEFAULT_CHART_COLOR

                );

            }
        );

    // ========================================================
    // INTERACTION CHART
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

            providerInteractionChart.update(
                'none'
            );

        } else {

            providerInteractionChart =
                new Chart(
                    interactionCanvas,
                    {

                        type: 'bar',

                        data: {

                            labels: labels,

                            datasets: [

                                {

                                    label:
                                        'Interactions',

                                    data:
                                        interactions,

                                    backgroundColor:
                                        colors,

                                    borderColor:
                                        colors,

                                    borderWidth: 1

                                }

                            ]

                        },

                        options:
                            chartOptions

                    }
                );

        }

    }

    // ========================================================
    // SESSION CHART
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

            providerSessionChart.update(
                'none'
            );

        } else {

            providerSessionChart =
                new Chart(
                    sessionCanvas,
                    {

                        type: 'bar',

                        data: {

                            labels: labels,

                            datasets: [

                                {

                                    label:
                                        'Sessions',

                                    data:
                                        sessions,

                                    backgroundColor:
                                        colors,

                                    borderColor:
                                        colors,

                                    borderWidth: 1

                                }

                            ]

                        },

                        options:
                            chartOptions

                    }
                );

        }

    }

    // ========================================================
    // LATENCY CHART
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

            latencyChart.data.datasets[0].backgroundColor =
                colors;

            latencyChart.data.datasets[0].borderColor =
                colors;

            latencyChart.update(
                'none'
            );

        } else {

            latencyChart =
                new Chart(
                    latencyCanvas,
                    {

                        type: 'bar',

                        data: {

                            labels: labels,

                            datasets: [

                                {

                                    label:
                                        'Average Latency (ms)',

                                    data:
                                        latency,

                                    backgroundColor:
                                        colors,

                                    borderColor:
                                        colors,

                                    borderWidth: 1

                                }

                            ]

                        },

                        options:
                            chartOptions

                    }
                );

        }

    }

}

// ============================================================
// TOKEN USAGE
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
            provider =>
                formatProductName(
                    provider.product ||
                    provider.provider
                )
        );

    const products =
        providers.map(
            provider =>
                provider.product ||
                provider.provider
        );

    const tokens =
        providers.map(
            provider =>
                getTokenValue(
                    provider
                )
        );

    const colors =
        getProductColors(
            products
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

        providerTokenChart.update(
            'none'
        );

        return;

    }

    providerTokenChart =
        new Chart(
            canvas,
            {

                type: 'bar',

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                'Tokens',

                            data:
                                tokens,

                            backgroundColor:
                                colors,

                            borderColor:
                                colors,

                            borderWidth: 1

                        }

                    ]

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

function updateEmployeeProductChart(
    employeeProducts
) {

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

    const employees = [

        ...new Set(

            employeeProducts.map(
                row =>
                    row.email
            )

        )

    ];

    const products = [

        ...new Set(

            employeeProducts.map(
                row =>
                    row.product
            )

        )

    ];

    const datasets =
        products.map(
            product => {

                const color =
                    getProductColor(
                        product
                    );

                return {

                    label:
                        formatProductName(
                            product
                        ),

                    data:
                        employees.map(
                            email => {

                                const row =
                                    employeeProducts.find(
                                        item =>

                                            item.email ===
                                            email

                                            &&

                                            item.product ===
                                            product
                                    );

                                return row

                                    ? Number(
                                        row.interactions
                                    ) || 0

                                    : 0;

                            }
                        ),

                    backgroundColor:
                        color,

                    borderColor:
                        color,

                    borderWidth: 1

                };

            }
        );

    if (employeeAiChart) {

        employeeAiChart.data.labels =
            employees;

        employeeAiChart.data.datasets =
            datasets;

        employeeAiChart.update(
            'none'
        );

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

                            stacked:
                                true

                        },

                        y: {

                            beginAtZero:
                                true,

                            stacked:
                                true

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

    employees.forEach(
        employee => {

            const row =
                document.createElement(
                    'tr'
                );

            const gemini =
                Number(
                    employee.gemini
                ) || 0;

            const chatgpt =
                Number(
                    employee.chatgpt
                ) || 0;

            const claude =
                Number(
                    employee.claude
                ) || 0;

            const copilot =
                Number(
                    employee.copilot
                ) || 0;

            const perplexity =
                Number(
                    employee.perplexity
                ) || 0;

            const qwen =
                Number(
                    employee.qwen
                ) || 0;

            const total =
                Number(
                    employee.interactions
                ) ||

                (

                    gemini +

                    chatgpt +

                    claude +

                    copilot +

                    perplexity +

                    qwen

                );

            const totalTokens =
                getTokenValue(
                    employee
                );

            row.innerHTML = `

                <td>
                    ${employee.email || '-'}
                </td>

                <td>
                    ${employee.department || '-'}
                </td>

                <td>
                    ${formatNumber(gemini)}
                </td>

                <td>
                    ${formatNumber(chatgpt)}
                </td>

                <td>
                    ${formatNumber(claude)}
                </td>

                <td>
                    ${formatNumber(copilot)}
                </td>

                <td>
                    ${formatNumber(perplexity)}
                </td>

                <td>
                    ${formatNumber(qwen)}
                </td>

                <td>
                    ${formatNumber(total)}
                </td>

                <td>
                    ${formatNumber(
                        employee.sessions
                    )}
                </td>

                <td>

                    ${
                        employee.avg_latency_ms != null

                            ? Number(
                                employee.avg_latency_ms
                            ).toFixed(0) + ' ms'

                            : 'N/A'
                    }

                </td>

                <td>
                    ${formatNumber(
                        totalTokens
                    )}
                </td>

            `;

            table.appendChild(
                row
            );

        }
    );

}

// ============================================================
// AI STATUS
// ============================================================

function updateAIStatus(products) {

    const status =
        document.querySelector(
            '.status'
        );

    if (!status) {
        return;
    }

    if (!Array.isArray(products)) {
        return;
    }

    const activeProducts =
        products.filter(
            product =>
                Number(
                    product.interactions
                ) > 0
        );

    status.innerHTML = `

        <span
            class="status-dot"
        ></span>

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
// INITIAL LOAD
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

// Refresh dashboard every 5 seconds.
//
// BNM itself is cached on the server, so this does NOT
// request BNM directly every 5 seconds.

setInterval(
    loadDashboard,
    5000
);

// ============================================================
// BNM RATE REFRESH
// ============================================================

// Refresh BNM rate every 15 minutes.

setInterval(
    loadBnmExchangeRate,
    15 * 60 * 1000
);