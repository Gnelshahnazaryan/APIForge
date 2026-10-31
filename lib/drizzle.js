const fs = require("node:fs");
const path = require("node:path");

const schema = "export {};\n";

function getConfig(answers) {
    const config = {
        PostgreSQL: `dialect: "postgresql",
    dbCredentials: { url: databaseUrl },`,
        MySQL: `dialect: "mysql",
    dbCredentials: { url: databaseUrl },`,
        SQLite: `dialect: "sqlite",
    dbCredentials: { url: databaseUrl.replace(/^file:/, "") },`,
    };

    return `import fs from "node:fs";
import { defineConfig } from "drizzle-kit";

if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
}

if (!process.env.DATABASE_URL) {
    throw new Error("Missing required environment variable: DATABASE_URL (see .env.example)");
}

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
    schema: "./src/database/schema.js",
    out: "./src/database/migrations",
    ${config[answers.database]}
});
`;
}

async function setupDrizzle(projectPath, answers) {
    const databasePath = path.join(projectPath, "src", "database");
    fs.mkdirSync(databasePath, { recursive: true });
    fs.writeFileSync(path.join(databasePath, "schema.js"), schema);
    fs.writeFileSync(path.join(projectPath, "drizzle.config.js"), getConfig(answers));
}

module.exports = { setupDrizzle, getConfig };
