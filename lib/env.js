const crypto = require("node:crypto");

// One list drives .env, .env.example and src/config/env.js.
// value: real local value for .env, example: safe placeholder for .env.example,
// required: src/config/env.js throws on startup if it's missing
function getEnvSections(answers, projectName) {
    const sections = [
        {
            title: "Server",
            vars: [
                { name: "PORT", value: "3000", example: "3000", read: `Number(process.env.PORT) || 3000` },
                { name: "NODE_ENV", value: "development", example: "development", read: `process.env.NODE_ENV || "development"` },
            ],
        },
    ];

    if (answers.cors) {
        sections.push({
            title: "CORS",
            vars: [{ name: "CORS_ORIGIN", value: "http://localhost:5173", example: "http://localhost:5173" }],
        });
    }

    if (answers.database === "MongoDB") {
        sections.push({
            title: "MongoDB",
            vars: [{
                name: "MONGODB_URI",
                value: `mongodb://localhost:27017/${projectName}`,
                example: `mongodb://localhost:27017/${projectName}`,
                required: true,
            }],
        });
    }

    if (answers.database === "PostgreSQL" && answers.postgresOrm === "Prisma") {
        sections.push({
            title: "PostgreSQL (Prisma)",
            vars: [{
                name: "DATABASE_URL",
                value: `"postgresql://postgres:postgres@localhost:5432/${projectName}?schema=public"`,
                example: `"postgresql://USER:PASSWORD@localhost:5432/${projectName}?schema=public"`,
                required: true,
            }],
        });
    }

    if (answers.database === "PostgreSQL" && answers.postgresOrm === "Sequelize") {
        sections.push({
            title: "PostgreSQL (Sequelize)",
            vars: [{
                name: "DB_URL",
                value: `postgres://postgres:postgres@localhost:5432/${projectName}`,
                example: `postgres://USER:PASSWORD@localhost:5432/${projectName}`,
                required: true,
            }],
        });
    }

    if (answers.redis) {
        sections.push({
            title: "Redis",
            vars: [{ name: "REDIS_URL", value: "redis://localhost:6379", example: "redis://localhost:6379", required: true }],
        });
    }

    if (answers.auth) {
        sections.push({
            title: "Auth",
            vars: [
                { name: "JWT_SECRET", value: crypto.randomBytes(32).toString("hex"), example: "change-me", required: true },
                { name: "JWT_EXPIRES_IN", value: "1d", example: "1d", read: `process.env.JWT_EXPIRES_IN || "1d"` },
            ],
        });
    }

    return sections;
}

function renderEnvFile(sections, key) {
    return sections
        .map(({ title, vars }) =>
            `# ${title}\n${vars.map((v) => `${v.name}=${v[key]}`).join("\n")}\n`
        )
        .join("\n");
}

// Without dotenv, Node's built-in process.loadEnvFile() (Node 20.12+) reads .env
function renderEnvModule(sections, useDotenv) {
    const vars = sections.flatMap((section) => section.vars);
    const required = vars.filter((v) => v.required).map((v) => `"${v.name}"`);

    const load = useDotenv
        ? `import dotenv from "dotenv";\n\ndotenv.config({ quiet: true });\n`
        : `import fs from "node:fs";\n\nif (fs.existsSync(".env")) {\n    process.loadEnvFile(".env");\n}\n`;

    const check = required.length > 0
        ? `
const required = [${required.join(", ")}];

for (const name of required) {
    if (!process.env[name]) {
        throw new Error(\`Missing required environment variable: \${name} (see .env.example)\`);
    }
}
`
        : "";

    const exportsBody = vars
        .map((v) => `    ${v.name}: ${v.read ?? `process.env.${v.name}`},`)
        .join("\n");

    return `${load}${check}
const env = {
${exportsBody}
};

export default env;
`;
}

function getEnvFiles(answers, projectName) {
    const sections = getEnvSections(answers, projectName);

    return {
        env: renderEnvFile(sections, "value"),
        example: renderEnvFile(sections, "example"),
        module: renderEnvModule(sections, answers.dotenv),
    };
}

module.exports = { getEnvFiles };
