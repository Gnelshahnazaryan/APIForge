const mongoose = `import mongoose from "mongoose";
import env from "./env.js";

export async function connectDatabase() {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB");
}
`;

// Prisma 7 needs a driver adapter; the client is generated into
// node_modules/@prisma/client by \`prisma generate\` (runs on postinstall)
const prisma = `import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import env from "./env.js";

export const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

export async function connectDatabase() {
    await prisma.$connect();
    console.log("Connected to PostgreSQL");
}
`;

const redis = `import { createClient } from "redis";
import env from "./env.js";

export const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (err) => {
    console.error("Redis error:", err.message);
});

export async function connectRedis() {
    await redis.connect();
    console.log("Connected to Redis");
}
`;

// Sequelize's connection is src/models/index.js (created by sequelize-cli),
// so it gets no file here
function getConnectionFiles(answers) {
    const files = [];

    if (answers.database === "MongoDB") {
        files.push({ path: "src/config/database.js", content: mongoose });
    }

    if (answers.database === "PostgreSQL" && answers.postgresOrm === "Prisma") {
        files.push({ path: "src/config/database.js", content: prisma });
    }

    if (answers.redis) {
        files.push({ path: "src/config/redis.js", content: redis });
    }

    return files;
}

module.exports = { getConnectionFiles };
