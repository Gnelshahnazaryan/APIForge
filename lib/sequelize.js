const fs = require("node:fs");
const path = require("node:path");
const { runCommand } = require("./run-command");

// Node loads this extensionless config as ESM in a "type": "module" project.
// Named exports let sequelize-cli read its config options through require(ESM).
const sequelizerc = `import path from "node:path";

const config = path.resolve("src/config", "database.cjs");
const modelsPath = path.resolve("src/models");
const migrationsPath = path.resolve("src/database/migrations");
const seedersPath = path.resolve("src/database/seeders");

export {
    config,
    modelsPath as "models-path",
    migrationsPath as "migrations-path",
    seedersPath as "seeders-path",
};
`;

// The generated CommonJS model index requires this config directly.
function getDatabaseConfig(answers) {
    const dialect = {
        PostgreSQL: "postgres",
        MySQL: "mysql",
        SQLite: "sqlite",
    }[answers.database];
    const connection = answers.database === "SQLite"
        ? `storage: process.env.DATABASE_URL.replace(/^file:/, ""),`
        : `use_env_variable: "DATABASE_URL",`;

    return `const fs = require("node:fs");

if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
}

if (!process.env.DATABASE_URL) {
    throw new Error("Missing required environment variable: DATABASE_URL (see .env.example)");
}

const config = {
    ${connection}
    dialect: "${dialect}",
    logging: false,
};

module.exports = { development: config, test: config, production: config };
`;
}

// sequelize-cli only generates CommonJS (models, migrations, seeders).
// A nested package.json keeps these folders CommonJS inside the ES module project
const commonjsPackageJson = `{ "type": "commonjs" }\n`;

async function setupSequelize(projectPath, answers) {
    fs.writeFileSync(path.join(projectPath, ".sequelizerc"), sequelizerc);

    // Written by us instead of `sequelize-cli init:config`,
    // which puts plain JSON (with a MySQL dialect) into a .js file
    fs.writeFileSync(
        path.join(projectPath, "src", "config", "database.cjs"),
        getDatabaseConfig(answers)
    );

    for (const command of ["init:models", "init:migrations", "init:seeders"]) {
        await runCommand(`npx sequelize-cli ${command}`, projectPath);
    }

    for (const folder of ["models", "database"]) {
        fs.writeFileSync(path.join(projectPath, "src", folder, "package.json"), commonjsPackageJson);
    }
}

module.exports = { setupSequelize, getDatabaseConfig, sequelizerc };
