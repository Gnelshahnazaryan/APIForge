const fs = require("node:fs");
const path = require("node:path");
const { runCommand } = require("./run-command");

// Use the JavaScript client generator so the generated ES module can import it
// from @prisma/client without requiring a separate output directory.
function getSchema(answers) {
    const provider = {
        PostgreSQL: "postgresql",
        MySQL: "mysql",
        SQLite: "sqlite",
    }[answers.database];

    return `// Prisma schema: https://pris.ly/d/prisma-schema
// After changing models, run: npm run db:migrate
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
}
`;
}

async function setupPrisma(projectPath, answers) {
    const provider = {
        PostgreSQL: "postgresql",
        MySQL: "mysql",
        SQLite: "sqlite",
    }[answers.database];

    await runCommand(`npx prisma init --datasource-provider ${provider} --no-skills`, projectPath);

    fs.writeFileSync(
        path.join(projectPath, "prisma", "schema.prisma"),
        getSchema(answers)
    );

    // Regenerates the client after every npm install, e.g. after cloning
    const packageJsonPath = path.join(projectPath, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    packageJson.scripts.postinstall = "prisma generate";
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    await runCommand("npx prisma generate", projectPath);
}

module.exports = { setupPrisma, getSchema };
