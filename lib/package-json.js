const fs = require("node:fs");
const path = require("node:path");

function addProperty(obj, key, value) {
    obj[key] = value;
}

function updatePackageJson(projectPath, answers) {
    const packageJsonPath = path.join(projectPath, "package.json");

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    packageJson.type = "module";
    packageJson.main = "src/server.js";
    packageJson.description = "Express backend app";
    packageJson.engines = { node: "^20.19.0 || >=22.12.0" };

    packageJson.scripts.dev = answers.nodemon ? "nodemon src/server.js" : "node src/server.js";
    packageJson.scripts.start = "node src/server.js";

    if (answers.test) {
        packageJson.scripts.test = "vitest run";
    }

    if (answers.orm === "Prisma") {
        packageJson.scripts["db:migrate"] = "prisma migrate dev";
        packageJson.scripts["db:generate"] = "prisma generate";
    } else if (answers.orm === "Drizzle") {
        packageJson.scripts["db:generate"] = "drizzle-kit generate";
        packageJson.scripts["db:migrate"] = "drizzle-kit migrate";
    } else if (answers.orm === "TypeORM") {
        packageJson.scripts["db:migrate"] = "typeorm migration:run -d src/config/database.js";
        packageJson.scripts["db:migration:generate"] =
            "typeorm migration:generate -d src/config/database.js src/database/migrations/Initial --esm";
    } else if (answers.orm === "Sequelize") {
        packageJson.scripts["db:migrate"] = "sequelize-cli db:migrate";
        packageJson.scripts["db:migrate:undo"] = "sequelize-cli db:migrate:undo";
        packageJson.scripts["db:seed"] = "sequelize-cli db:seed:all";
    }

    if (answers.lint) {
        packageJson.scripts.lint = "eslint .";
        packageJson.scripts["lint:fix"] = "eslint . --fix";
        packageJson.scripts.format = "prettier --write .";
        packageJson.scripts["format:check"] = "prettier --check .";
    }

    const imports = {
        "#src/*": "./src/*.js",
        "#config/*": "./src/config/*.js",
        "#constants/*": "./src/constants/*.js",
        "#controllers/*": "./src/controllers/*.js",
        "#errors/*": "./src/errors/*.js",
        "#middlewares/*": "./src/middlewares/*.js",
        "#routes/*": "./src/routes/*.js",
        "#services/*": "./src/services/*.js",
        "#utils/*": "./src/utils/*.js",
    };

    if (answers.database !== "None") {
        addProperty(imports, "#repositories/*", "./src/repositories/*.js");
    }

    if (
        answers.database === "MongoDB" ||
        answers.orm === "Sequelize" ||
        answers.orm === "TypeORM"
    ) {
        addProperty(imports, "#models/*", "./src/models/*.js");
    }

    if (answers.validation) {
        addProperty(imports, "#validators/*", "./src/validators/*.js");
    }

    if (answers.test) {
        addProperty(imports, "#tests/*", "./tests/*.js");
    }

    packageJson.imports = imports;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

module.exports = { updatePackageJson };
