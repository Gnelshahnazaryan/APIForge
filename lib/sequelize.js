const fs = require("node:fs");
const path = require("node:path");
const { runCommand } = require("./run-command");

// .sequelizerc has no extension, so in a "type": "module" project Node loads it
// as an ES module. String export names let sequelize-cli read "models-path" etc.
const sequelizerc = `import path from "node:path";

const config = path.resolve("src/config", "database.js");
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

// sequelize-cli reads the default export; models/index.js does require(config)[env],
// which needs the named exports. Importing ./env.js loads .env and checks DB_URL
const databaseConfig = `import "./env.js";

const config = {
    use_env_variable: "DB_URL",
    dialect: "postgres",
    logging: false,
};

export const development = config;
export const test = config;
export const production = config;

export default { development, test, production };
`;

// sequelize-cli only generates CommonJS (models, migrations, seeders).
// A nested package.json keeps these folders CommonJS inside the ES module project
const commonjsPackageJson = `{ "type": "commonjs" }\n`;

async function setupSequelize(projectPath) {
    fs.writeFileSync(path.join(projectPath, ".sequelizerc"), sequelizerc);

    // Written by us instead of `sequelize-cli init:config`,
    // which puts plain JSON (with a MySQL dialect) into a .js file
    fs.writeFileSync(
        path.join(projectPath, "src", "config", "database.js"),
        databaseConfig
    );

    for (const command of ["init:models", "init:migrations", "init:seeders"]) {
        await runCommand(`npx sequelize-cli ${command}`, projectPath);
    }

    for (const folder of ["models", "database"]) {
        fs.writeFileSync(path.join(projectPath, "src", folder, "package.json"), commonjsPackageJson);
    }
}

module.exports = { setupSequelize };
