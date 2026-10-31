const { getLog, loggerImport } = require("./app-files");

const mongoose = `import mongoose from "mongoose";
import env from "./env.js";

export async function connectDatabase() {
    await mongoose.connect(env.MONGODB_URI);
}

export async function disconnectDatabase() {
    await mongoose.disconnect();
}
`;

// Prisma 7 needs a driver adapter; the client is generated into
// node_modules/@prisma/client by \`prisma generate\` (runs on postinstall)
function getPrismaFile(answers) {
    const adapters = {
        PostgreSQL: `import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });`,
        MySQL: `import { PrismaMariaDb } from "@prisma/adapter-mariadb";
const url = new URL(env.DATABASE_URL);
const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
});`,
        SQLite: `import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });`,
    };

    return `import { PrismaClient } from "@prisma/client";
import env from "./env.js";
${adapters[answers.database]}

export const prisma = new PrismaClient({ adapter });

export async function connectDatabase() {
    await prisma.$connect();
}

export async function disconnectDatabase() {
    await prisma.$disconnect();
}
`;
}

function getDrizzleFile(database) {
    const configs = {
        PostgreSQL: `import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const client = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(client);

export async function connectDatabase() {
    await client.query("SELECT 1");
}

export async function disconnectDatabase() {
    await client.end();
}
`,
        MySQL: `import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const client = mysql.createPool(env.DATABASE_URL);
export const db = drizzle(client);

export async function connectDatabase() {
    await client.query("SELECT 1");
}

export async function disconnectDatabase() {
    await client.end();
}
`,
        SQLite: `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const client = new Database(env.DATABASE_URL.replace(/^file:/, ""));
export const db = drizzle(client);

export async function connectDatabase() {
    client.prepare("SELECT 1").get();
}

export async function disconnectDatabase() {
    client.close();
}
`,
    };

    return `import env from "./env.js";
${configs[database]}`;
}

function getTypeOrmFile(database) {
    const options = {
        PostgreSQL: `type: "postgres",
    url: env.DATABASE_URL,`,
        MySQL: `type: "mysql",
    url: env.DATABASE_URL,`,
        SQLite: `type: "better-sqlite3",
    database: env.DATABASE_URL.replace(/^file:/, ""),`,
    };

    return `import "reflect-metadata";
import { DataSource } from "typeorm";
import env from "./env.js";

const dataSource = new DataSource({
    ${options[database]}
    entities: ["src/models/**/*.js"],
    migrations: ["src/database/migrations/**/*.js"],
    synchronize: false,
});

export async function connectDatabase() {
    await dataSource.initialize();
}

export async function disconnectDatabase() {
    if (dataSource.isInitialized) {
        await dataSource.destroy();
    }
}

export default dataSource;
`;
}

function getRedisFile(answers) {
    return `import { createClient } from "redis";
import env from "./env.js";
${loggerImport(answers, "config")}
export const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (err) => {
    ${getLog(answers)}.error(\`Redis error: \${err.message}\`);
});

export async function connectRedis() {
    await redis.connect();
}

export async function disconnectRedis() {
    await redis.quit();
}
`;
}

// Sequelize's connection is src/models/index.js (created by sequelize-cli),
// so it gets no file here
function getConnectionFiles(answers) {
    const files = [];

    if (answers.database === "MongoDB") {
        files.push({ path: "src/config/database.js", content: mongoose });
    }

    if (["PostgreSQL", "MySQL", "SQLite"].includes(answers.database)) {
        if (answers.orm === "Prisma") {
            files.push({ path: "src/config/database.js", content: getPrismaFile(answers) });
        } else if (answers.orm === "Drizzle") {
            files.push({
                path: "src/config/database.js",
                content: getDrizzleFile(answers.database),
            });
        } else if (answers.orm === "TypeORM") {
            files.push({
                path: "src/config/database.js",
                content: getTypeOrmFile(answers.database),
            });
        }
    }

    if (answers.redis) {
        files.push({ path: "src/config/redis.js", content: getRedisFile(answers) });
    }

    return files;
}

module.exports = { getConnectionFiles };
