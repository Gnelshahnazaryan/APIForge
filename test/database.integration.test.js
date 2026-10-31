const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
    createGeneratedProject,
    run,
} = require("./helpers/generated-project");

const database = process.env.API_FORGE_TEST_DATABASE;
const orm = process.env.API_FORGE_TEST_ORM;
const databaseUrl = process.env.API_FORGE_TEST_URL;

const enabled = Boolean(database && databaseUrl);

test(
    "generated database configuration connects and executes a smoke query",
    {
        skip: enabled ? false : "Set API_FORGE_TEST_DATABASE and API_FORGE_TEST_URL to enable",
        timeout: 600_000,
    },
    async (t) => {
        const answers =
            database === "MongoDB"
                ? { database, dotenv: true }
                : { database, orm, dotenv: true };

        if (database !== "MongoDB" && !["Prisma", "Drizzle", "TypeORM", "Sequelize"].includes(orm)) {
            throw new Error(`Unsupported ORM for database integration test: ${orm}`);
        }

        const project = await createGeneratedProject(answers);
        t.after(() => project.cleanup());

        const variable = database === "MongoDB" ? "MONGODB_URI" : "DATABASE_URL";
        const envPath = path.join(project.directory, ".env");
        const envLines = fs
            .readFileSync(envPath, "utf8")
            .split(/\r?\n/)
            .filter((line) => !line.startsWith(`${variable}=`));
        envLines.push(`${variable}=${databaseUrl}`);
        fs.writeFileSync(envPath, `${envLines.join("\n")}\n`);

        const smokeScript = database === "MongoDB" ? mongoSmokeScript() : sqlSmokeScript(database, orm);
        const scriptPath = path.join(project.directory, "database-smoke.mjs");
        fs.writeFileSync(scriptPath, smokeScript);

        const output = run(process.execPath, [scriptPath], project.directory, {
            timeout: 60_000,
            env: { [variable]: databaseUrl },
        });
        assert.match(output, /database smoke test passed/);
    }
);

function sqlSmokeScript(database, orm) {
    if (orm === "Prisma") {
        return `import { prisma, connectDatabase, disconnectDatabase } from "./src/config/database.js";
try {
    await connectDatabase();
    await prisma.$queryRaw\`SELECT 1\`;
    console.log("database smoke test passed");
} finally {
    await disconnectDatabase();
}
`;
    }

    if (orm === "Drizzle") {
        const query = database === "SQLite"
            ? `await db.get(sql\`SELECT 1\`);`
            : `await db.execute(sql\`SELECT 1\`);`;
        return `import { db, connectDatabase, disconnectDatabase } from "./src/config/database.js";
import { sql } from "drizzle-orm";
try {
    await connectDatabase();
    ${query}
    console.log("database smoke test passed");
} finally {
    await disconnectDatabase();
}
`;
    }

    if (orm === "TypeORM") {
        return `import dataSource, { connectDatabase, disconnectDatabase } from "./src/config/database.js";
try {
    await connectDatabase();
    await dataSource.query("SELECT 1");
    console.log("database smoke test passed");
} finally {
    await disconnectDatabase();
}
`;
    }

    return `import db from "./src/models/index.js";
try {
    await db.sequelize.authenticate();
    await db.sequelize.query("SELECT 1");
    console.log("database smoke test passed");
} finally {
    await db.sequelize.close();
}
`;
}

function mongoSmokeScript() {
    return `import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "./src/config/database.js";
try {
    await connectDatabase();
    await mongoose.connection.db.admin().ping();
    console.log("database smoke test passed");
} finally {
    await disconnectDatabase();
}
`;
}
