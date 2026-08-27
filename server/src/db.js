const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.on("error", (err) => {
    console.error("[ai-obs] Unexpected PostgreSQL error:", err);
});

async function testDatabase() {
    const result = await pool.query("SELECT NOW()");

    console.log(
        "[ai-obs] PostgreSQL connected:",
        result.rows[0].now
    );
}

module.exports = {
    pool,
    testDatabase
};