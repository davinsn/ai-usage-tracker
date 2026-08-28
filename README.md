# AI Observability & Usage Tracker

An enterprise AI observability platform for tracking, monitoring, and analyzing AI usage through the **OpenRouter API**.

The system provides a centralized dashboard for monitoring AI interactions, sessions, employees, models, providers, latency, token consumption, and estimated AI costs.

OpenRouter acts as the **AI gateway**, allowing the application to interact with multiple underlying AI model providers through a single API.

---

## Overview

The AI Observability & Usage Tracker is designed to provide organizations with visibility into how AI is being used across their applications.

The system captures AI usage data from requests made through OpenRouter and stores normalized usage events in PostgreSQL.

The dashboard provides an overview of:

* AI interactions
* AI sessions
* Active employees
* AI platforms
* AI providers
* AI models
* Prompt tokens
* Response tokens
* Total tokens
* Response latency
* Estimated AI cost
* USD → MYR conversion
* Cost by AI platform
* Provider performance

---

# Architecture

The application follows an API-first architecture.

```text
                 Employee / Application
                          │
                          ▼
                   Node.js Backend
                          │
                          ▼
                     OpenRouter
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
          OpenAI        Google      Anthropic
             │            │            │
             └────────────┼────────────┘
                          │
                          ▼
                    AI Response
                          │
                          ▼
                   Node.js Backend
                          │
                          ▼
                      PostgreSQL
                          │
                          ▼
                 Dashboard API
                          │
                          ▼
               AI Observability UI
```

OpenRouter acts as the **gateway**, while the underlying AI provider is determined from the model being requested.

For example:

```text
OpenRouter
    │
    ├── openai/...
    │      └── Provider: OpenAI
    │
    ├── google/...
    │      └── Provider: Google
    │
    └── anthropic/...
           └── Provider: Anthropic
```

This allows the dashboard to distinguish providers even though all AI requests are routed through OpenRouter.

---

# Key Concepts

## Gateway

The gateway is the service through which AI requests are sent.

For this project:

```text
Gateway = OpenRouter
```

OpenRouter provides a unified API for accessing multiple AI models.

---

## Provider

The provider is the company responsible for the underlying AI model.

Examples include:

```text
OpenAI
Google
Anthropic
Microsoft
Meta
```

The provider is derived from the model identifier where applicable.

---

## Model

The model is the specific AI model used to generate a response.

Examples:

```text
openai/...
google/...
anthropic/...
```

The complete model identifier should be retained in the database so that usage can be analyzed at model level.

---

## Product

The product represents the application or AI platform associated with the usage.

For example, an organization may define products such as:

```text
Internal AI Assistant
Customer Support AI
Developer Assistant
Research Assistant
```

The product is separate from the underlying model provider.

---

# Features

## AI Interaction Tracking

The system records completed AI interactions.

An interaction represents a request sent to an AI model and the corresponding response.

The dashboard displays the total number of recorded AI interactions.

---

## Session Tracking

AI usage can be grouped into sessions.

A session represents a period of AI usage associated with an employee and application/platform.

This allows the system to distinguish:

```text
Interactions
        ↓
Sessions
        ↓
Employees
```

---

## Employee Usage

The system associates AI usage with employees.

The dashboard can therefore identify:

* Which employees are using AI
* How many interactions they have generated
* Which AI products they use
* How much AI usage they generate

---

## Provider Tracking

The system distinguishes AI providers based on the model used through OpenRouter.

For example:

```text
Model                         Provider
------------------------------------------------
openai/...                    OpenAI
google/...                    Google
anthropic/...                 Anthropic
```

This allows provider-level analysis without treating OpenRouter as the underlying AI provider.

---

## Model Tracking

The specific model used for every interaction can be stored.

This allows future analysis such as:

* Usage by model
* Cost by model
* Latency by model
* Token usage by model
* Provider comparison

---

# Token Tracking

OpenRouter responses can provide token usage information for supported models.

The system records:

```text
Prompt Tokens
Response Tokens
Total Tokens
```

Where available, provider/API-reported token usage should be used instead of estimating token counts.

### Token definitions

**Prompt Tokens**

Tokens consumed by the user's input and other input context.

**Response Tokens**

Tokens generated by the AI model.

**Total Tokens**

Combined input and output token usage.

```text
Total Tokens
=
Prompt Tokens
+
Response Tokens
```

---

# Latency Tracking

The backend measures the time taken for an AI request to receive a response.

Latency is stored in milliseconds:

```text
latency_ms
```

The dashboard uses this information to display:

* Average latency
* Latency by provider
* Latency by AI platform

This allows organizations to compare AI response performance.

---

# Cost Tracking

The system calculates estimated AI usage costs using token consumption and model pricing.

The basic calculation is:

```text
Input Cost
+
Output Cost
=
Total Cost
```

Where applicable:

```text
Input Tokens × Input Price
+
Output Tokens × Output Price
=
Estimated Cost (USD)
```

The resulting cost can then be converted into Malaysian Ringgit.

---

# USD → MYR Conversion

The dashboard includes USD → MYR conversion for reporting AI costs in Malaysian Ringgit.

The backend exposes:

```text
GET /api/exchange-rate
```

The dashboard uses the returned USD → MYR rate to calculate:

```text
Estimated Cost (MYR)
```

The dashboard displays the exchange rate as the BNM middle rate.

---

# Database

PostgreSQL is used as the primary database.

The central usage-event structure contains fields such as:

```text
provider
product
event_type
session_id
interaction_id
model
occurred_at
latency_ms
prompt_length
response_length
prompt_tokens
response_tokens
total_tokens
metadata
```

---

# Usage Event Fields

| Field             | Description                                      |
| ----------------- | ------------------------------------------------ |
| `provider`        | Underlying AI model provider                     |
| `product`         | AI application/platform                          |
| `event_type`      | Type of usage event                              |
| `session_id`      | Identifier for the AI session                    |
| `interaction_id`  | Identifier for an individual interaction         |
| `model`           | Specific model used                              |
| `occurred_at`     | Timestamp of the event                           |
| `latency_ms`      | AI response latency in milliseconds              |
| `prompt_length`   | Length of the user prompt                        |
| `response_length` | Length of the AI response                        |
| `prompt_tokens`   | Number of input tokens                           |
| `response_tokens` | Number of output tokens                          |
| `total_tokens`    | Total input + output tokens                      |
| `metadata`        | Additional information associated with the event |

---

# Event Types

The system uses event types to describe AI activity.

A completed AI request can be represented using:

```text
interaction_completed
```

Event types allow the backend to distinguish completed interactions from other possible events.

---

# API

The Node.js backend exposes API endpoints used by the dashboard.

## Usage Summary

```text
GET /api/usage/summary
```

Provides high-level usage statistics such as:

* AI interactions
* AI sessions
* Active employees
* Average latency
* Total tokens
* Cost

---

## Usage by Employee

```text
GET /api/usage/by-employee
```

Returns AI usage grouped by employee.

This powers the employee AI usage visualization.

---

## Usage by Provider

```text
GET /api/usage/by-provider
```

Returns usage and performance information grouped by underlying AI provider.

This is used for provider-level analysis such as latency.

---

## Usage by Product

```text
GET /api/usage/by-product
```

Returns AI usage grouped by AI product/platform.

This supports the cost and performance breakdown table.

---

## Usage by Employee and Product

```text
GET /api/usage/by-employee-product
```

Provides usage grouped by employee and AI product.

This allows the dashboard to understand which employees are using which AI platforms.

---

## Exchange Rate

```text
GET /api/exchange-rate
```

Returns the current USD → MYR exchange-rate information used by the dashboard.

---

# Dashboard

The dashboard is built using:

* HTML
* CSS
* JavaScript
* Chart.js

The dashboard automatically retrieves information from the Node.js backend.

---

# Dashboard KPI Cards

The dashboard currently displays the following KPI cards.

## AI Interactions

Total number of completed AI interactions recorded.

---

## AI Sessions

Number of unique AI usage sessions.

---

## Active Employees

Number of employees with recorded AI activity.

---

## Average Latency

Average response latency across recorded AI interactions.

Displayed in milliseconds.

---

## Total Tokens

Total input and output token usage.

---

## Estimated Cost (USD)

Total estimated AI usage cost in USD.

---

## USD → MYR

Current USD → MYR exchange rate.

---

## Estimated Cost (MYR)

Total estimated AI usage cost converted from USD into MYR.

---

# Dashboard Charts

## Employee AI Usage

Displays AI interactions by employee and platform.

This provides visibility into AI adoption across employees.

---

## Latency by Provider

Displays average response latency grouped by AI provider.

For example:

```text
OpenAI
Google
Anthropic
```

This makes it possible to compare provider response performance.

---

# Cost & Performance by AI Platform

The dashboard contains a detailed breakdown table.

| Column          | Description                       |
| --------------- | --------------------------------- |
| AI Platform     | AI product/platform               |
| Interactions    | Number of AI interactions         |
| Sessions        | Number of AI sessions             |
| Tokens          | Total token usage                 |
| Avg Latency     | Average response latency          |
| Cost (USD)      | Estimated AI cost in USD          |
| Cost (MYR)      | Estimated AI cost in MYR          |
| % of Total Cost | Platform's share of total AI cost |

The table supports sorting by:

* Tokens
* Average latency
* USD cost
* MYR cost
* Percentage of total cost

---

# Dashboard Guide

The dashboard includes a guide explaining the major metrics.

The main definitions are:

```text
AI Interactions
→ Total completed AI requests

AI Sessions
→ Unique AI usage sessions

Active Employees
→ Employees with recorded AI activity

Average Latency
→ Average AI response time

Tokens
→ Input + output tokens

Estimated Cost (USD)
→ Estimated AI usage cost in USD

Estimated Cost (MYR)
→ USD cost converted to MYR

AI Platform
→ Application/product associated with AI usage

Provider
→ Company providing the underlying AI model

Cost % of Total
→ Platform's percentage of total AI spending
```

---

# Project Structure

The project is organized into the backend, database, API routes, and dashboard.

A typical structure is:

```text
AI-USAGE-TRACKER/
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── server.js
│
├── db.js
│
├── routes/
│   ├── usage.js
│   └── ai.js
│
└── public/
    ├── index.html
    ├── dashboard.js
    └── style.css
```

The exact structure may vary depending on the current implementation.

---

# Technology Stack

## Backend

* Node.js
* Express.js
* PostgreSQL

## Frontend

* HTML
* CSS
* JavaScript
* Chart.js

## AI Gateway

* OpenRouter API

## AI Providers

The application can access supported providers/models available through OpenRouter.

Examples include:

* OpenAI
* Google
* Anthropic
* Microsoft
* Meta

---

# Environment Configuration

Create a `.env` file in the project root.

Example:

```env
PORT=4000

DATABASE_URL=your_postgresql_connection_string

OPENROUTER_API_KEY=your_openrouter_api_key
```

The exact environment variables should match the current backend configuration.

---

# OpenRouter API Key

The OpenRouter API key must remain on the server.

It should be accessed through:

```javascript
process.env.OPENROUTER_API_KEY
```

The API key must **never** be placed directly in:

* `index.html`
* `dashboard.js`
* `style.css`
* public frontend code
* GitHub repositories
* screenshots
* documentation

The frontend should communicate with the Node.js backend rather than directly exposing the OpenRouter key.

---

# Security

## Environment Variables

Sensitive credentials should be stored in `.env`.

Example `.gitignore`:

```gitignore
.env
.env.*
!.env.example
```

Never commit real API keys or database credentials.

---

## API Key Architecture

The recommended request flow is:

```text
Frontend
    │
    ▼
Node.js Backend
    │
    │  OPENROUTER_API_KEY
    ▼
OpenRouter
    │
    ▼
AI Provider
```

This keeps the OpenRouter API key outside the browser.

---

# Installation

## 1. Clone the repository

```bash
git clone <repository-url>
cd <project-directory>
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure PostgreSQL

Create the PostgreSQL database required by the application.

Configure the database connection in `.env`.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

---

## 4. Configure OpenRouter

Add the OpenRouter API key:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
```

Make sure the OpenRouter account has the required access/credits for the models being used.

---

## 5. Start the server

```bash
npm start
```

If the project uses a development script:

```bash
npm run dev
```

The application should then be available through the configured server port.

Example:

```text
http://localhost:4000
```

---

# Usage Flow

A typical API interaction follows this process:

```text
1. Employee/Application sends an AI request
                ↓
2. Node.js backend receives the request
                ↓
3. Backend sends request to OpenRouter
                ↓
4. OpenRouter routes request to selected model
                ↓
5. AI provider generates response
                ↓
6. OpenRouter returns response + usage information
                ↓
7. Backend records usage information
                ↓
8. PostgreSQL stores the usage event
                ↓
9. Dashboard API aggregates the data
                ↓
10. Dashboard displays updated metrics
```

---

# Provider Identification

OpenRouter allows the application to use models from different providers.

The system should retain the full model identifier.

For example:

```text
openai/model-name
google/model-name
anthropic/model-name
```

The provider can then be identified from the model namespace.

Conceptually:

```javascript
const [provider, modelName] = model.split("/");
```

This allows the database to store:

```text
provider = openai
model = openai/model-name
```

rather than incorrectly treating OpenRouter as the provider.

---

# Why OpenRouter?

Using OpenRouter provides a unified API layer for accessing multiple AI models.

Benefits include:

* Single API integration
* Multiple AI providers
* Standardized request format
* Model selection
* Usage information
* Simplified provider switching
* Centralized AI request handling

This makes OpenRouter suitable for an observability system that needs to compare multiple AI providers.

---

# Data Normalization

One of the main purposes of this project is to normalize AI usage into a common structure.

Different models may return different information, but the backend maps the relevant information into a standardized usage event.

```text
OpenAI request
       │
       ▼
┌──────────────────────┐
│                      │
│ provider             │
│ product              │
│ model                │
│ session_id           │
│ interaction_id       │
│ latency_ms           │
│ prompt_tokens        │
│ response_tokens      │
│ total_tokens         │
│ metadata             │
│                      │
└──────────────────────┘
       ▲
       │
Google request
       │
       │
Anthropic request
```

This allows the dashboard to compare usage across different providers using the same metrics.

---

# Cost Analysis

The system can be used to analyze:

### Total AI spending

```text
Total AI Cost
```

### Spending by platform

```text
Platform A → $X
Platform B → $Y
Platform C → $Z
```

### Spending by provider

```text
OpenAI → $X
Google → $Y
Anthropic → $Z
```

### Spending by employee

Future employee-level cost analysis can use the same normalized usage data.

---

# Performance Analysis

The collected latency data can be used to identify:

* Fastest providers
* Slowest providers
* High-latency models
* Average organizational response time
* Performance trends over time

Example:

```text
Provider       Average Latency
--------------------------------
OpenAI         XXX ms
Google         XXX ms
Anthropic      XXX ms
```

---

# Troubleshooting

## Dashboard shows zero interactions

Check:

1. The Node.js server is running.
2. PostgreSQL is running.
3. Usage events exist in the database.
4. The API endpoint returns data.
5. The dashboard is calling the correct endpoint.
6. `event_type` matches the backend query.
7. Employee identifiers are correctly associated with usage events.

---

## Provider is showing as OpenRouter

If every record shows:

```text
provider = openrouter
```

check the provider mapping.

OpenRouter is the gateway.

The desired structure is:

```text
gateway  = OpenRouter
provider = OpenAI / Google / Anthropic / etc.
model    = provider/model
```

If a dedicated gateway column does not exist, the gateway can be stored in metadata.

---

## Token usage is missing

Check the OpenRouter response for usage information.

If the selected model/API response does not provide the expected token fields, the backend may need to handle the response format accordingly.

---

## Cost is incorrect

Check:

1. The model being used.
2. Input token count.
3. Output token count.
4. Model pricing configuration.
5. USD → MYR conversion rate.
6. Whether the cost calculation is using the correct pricing units.

---

## USD → MYR is not loading

Check:

1. `/api/exchange-rate`
2. Backend network/API access
3. BNM response
4. Frontend element IDs
5. Browser console errors

---

# Development Principles

The project follows several key principles.

## Centralized AI Access

AI requests should flow through the backend and OpenRouter.

## Normalized Usage Data

Different AI models should be represented using a consistent usage-event structure.

## Provider Separation

OpenRouter should be treated as the gateway, while the underlying model provider should be tracked separately.

## Secure API Keys

API keys should remain server-side.

## Observable AI Usage

Every completed interaction should provide as much usage information as possible, including tokens, latency, model, provider, and cost.

---

# Future Improvements

Potential future enhancements include:

* Model-level cost breakdown
* Provider-level cost breakdown
* Employee-level cost reporting
* Department-level reporting
* Daily usage trends
* Weekly usage trends
* Monthly usage trends
* Date-range filtering
* AI adoption tracking
* Error-rate monitoring
* Failed request tracking
* Model performance comparison
* Provider performance comparison
* Exportable reports
* Role-based dashboard access
* More detailed OpenRouter metadata
* AI energy/compute impact estimation
* Budget monitoring
* Cost alerts
* Usage limits

---

# Project Goal

The goal of the AI Observability & Usage Tracker is to provide organizations with a centralized view of AI adoption, performance, and cost.

The system is designed to answer four key questions:

```text
WHO is using AI?
        ↓
WHAT AI products and models are being used?
        ↓
HOW MUCH AI usage is occurring?
        ↓
HOW MUCH does the usage cost and HOW WELL does it perform?
```

By routing AI requests through OpenRouter and storing standardized usage events in PostgreSQL, the platform provides a foundation for monitoring AI usage across multiple providers from a single dashboard.

---

# Status

The project is currently focused on:

* OpenRouter API integration
* PostgreSQL usage tracking
* AI interaction monitoring
* Employee usage analytics
* Provider tracking
* Model tracking
* Token tracking
* Latency monitoring
* AI cost calculation
* USD → MYR conversion
* Dashboard visualization

The system is designed to be extended as additional models, providers, metrics, and reporting requirements are introduced.
