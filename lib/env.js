const crypto = require("node:crypto");

// One list drives .env, .env.example and src/config/env.js.
// required: src/config/env.js throws on startup if the value is missing.
function getEnvSections(answers, projectName) {
    const sections = [
        {
            title: "Server",
            vars: [
                { name: "PORT", value: "3000", example: "3000", read: "Number(process.env.PORT) || 3000" },
                { name: "NODE_ENV", value: "development", example: "development", read: 'process.env.NODE_ENV || "development"' },
            ],
        },
    ];

    if (answers.cors || answers.socketio) {
        sections.push({
            title: "CORS",
            vars: [{
                name: "CORS_ORIGIN",
                value: "http://localhost:5173",
                example: "http://localhost:5173",
            }],
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

    if (["PostgreSQL", "MySQL", "SQLite"].includes(answers.database)) {
        const databaseUrl = {
            PostgreSQL: `postgresql://postgres:password@localhost:5432/${projectName}?schema=public`,
            MySQL: `mysql://root:password@localhost:3306/${projectName}`,
            SQLite: "file:./dev.db",
        }[answers.database];

        sections.push({
            title: `${answers.database} (${answers.orm})`,
            vars: [{
                name: "DATABASE_URL",
                value: databaseUrl,
                example: databaseUrl,
                required: true,
            }],
        });
    }

    if (answers.redis) {
        sections.push({
            title: "Redis",
            vars: [{
                name: "REDIS_URL",
                value: "redis://localhost:6379",
                example: "redis://localhost:6379",
                required: true,
            }],
        });
    }

    if (answers.multer) {
        sections.push({
            title: "File uploads",
            vars: [
                { name: "UPLOAD_DIR", value: "uploads", example: "uploads" },
                { name: "UPLOAD_MAX_FILE_SIZE_MB", value: "5", example: "5", read: "Number(process.env.UPLOAD_MAX_FILE_SIZE_MB) || 5" },
            ],
        });
    }

    if (answers.email) {
        sections.push({
            title: "Email (SMTP)",
            vars: [
                { name: "SMTP_HOST", value: "smtp.example.com", example: "smtp.example.com", required: true },
                { name: "SMTP_PORT", value: "587", example: "587", read: "Number(process.env.SMTP_PORT) || 587" },
                { name: "SMTP_SECURE", value: "false", example: "false", read: 'process.env.SMTP_SECURE === "true"' },
                { name: "SMTP_USER", value: "", example: "" },
                { name: "SMTP_PASSWORD", value: "", example: "" },
                { name: "SMTP_FROM", value: "no-reply@example.com", example: "no-reply@example.com", required: true },
            ],
        });
    }

    if (answers.auth) {
        const vars = [
            { name: "JWT_SECRET", value: crypto.randomBytes(32).toString("hex"), example: "change-me", required: true },
            { name: "JWT_EXPIRES_IN", value: "1d", example: "1d", read: 'process.env.JWT_EXPIRES_IN || "1d"' },
        ];

        if (answers.refreshTokens) {
            vars.push(
                { name: "JWT_REFRESH_SECRET", value: crypto.randomBytes(32).toString("hex"), example: "change-me-refresh-secret", required: true },
                { name: "JWT_REFRESH_EXPIRES_IN", value: "7d", example: "7d", read: 'process.env.JWT_REFRESH_EXPIRES_IN || "7d"' }
            );
        }

        sections.push({
            title: "Auth",
            vars,
        });
    }

    return sections;
}

function renderEnvFile(sections, key) {
    return sections
        .map(({ title, vars }) =>
            `# ${title}\n${vars.map((variable) => `${variable.name}=${variable[key]}`).join("\n")}\n`
        )
        .join("\n");
}

// Without dotenv, Node's built-in process.loadEnvFile() (Node 20.12+) reads .env.
function renderEnvModule(sections, useDotenv) {
    const vars = sections.flatMap((section) => section.vars);

    const load = useDotenv
        ? `import dotenv from "dotenv";\n\ndotenv.config({ quiet: true });\n`
        : `import fs from "node:fs";\n\nif (fs.existsSync(".env")) {\n    process.loadEnvFile(".env");\n}\n`;

    const check = `
for (const name of REQUIRED_ENV_VARS) {
    if (!process.env[name]) {
        throw new Error(\`Missing required environment variable: \${name} (see .env.example)\`);
    }
}
`;

    const exportsBody = vars
        .map((variable) => `    ${variable.name}: ${variable.read ?? `process.env.${variable.name}`},`)
        .join("\n");

    return `${load}import { REQUIRED_ENV_VARS } from "#constants/env.constants";
${check}
const env = {
${exportsBody}
};

export default env;
`;
}

function getEnvFiles(answers, projectName) {
    const sections = getEnvSections(answers, projectName);
    const required = sections
        .flatMap((section) => section.vars)
        .filter((variable) => variable.required)
        .map((variable) => `"${variable.name}"`);

    return {
        env: renderEnvFile(sections, "value"),
        example: renderEnvFile(sections, "example"),
        module: renderEnvModule(sections, answers.dotenv),
        constants: `export const REQUIRED_ENV_VARS = Object.freeze([${required.join(", ")}]);\n`,
    };
}

module.exports = { getEnvFiles };
