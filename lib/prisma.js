const fs = require("node:fs");
const path = require("node:path");
const { runCommand } = require("./run-command");

// prisma init writes the new "prisma-client" generator, which outputs TypeScript.
// "prisma-client-js" outputs plain JS into node_modules/@prisma/client,
// so a CommonJS project can require("@prisma/client")
const schema = `// Prisma schema: https://pris.ly/d/prisma-schema
// After changing models, run: npx prisma migrate dev

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
`;

async function setupPrisma(projectPath) {
    await runCommand("npx prisma init --datasource-provider postgresql --no-skills", projectPath);

    fs.writeFileSync(path.join(projectPath, "prisma", "schema.prisma"), schema);

    // Regenerates the client after every npm install, e.g. after cloning
    const packageJsonPath = path.join(projectPath, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    packageJson.scripts.postinstall = "prisma generate";
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    await runCommand("npx prisma generate", projectPath);
}

module.exports = { setupPrisma };
