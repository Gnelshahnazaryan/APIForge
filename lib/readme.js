function getStack(answers) {
    const stack = [];

    stack.push("Express");
    if (answers.database === "MongoDB") stack.push("MongoDB + Mongoose");
    if (["PostgreSQL", "MySQL", "SQLite"].includes(answers.database)) {
        stack.push(`${answers.database} + ${answers.orm}`);
    }
    if (answers.redis) stack.push("Redis");
    if (answers.auth) stack.push("JWT auth (jsonwebtoken + cookie-parser)");
    if (answers.bcrypt) stack.push("bcrypt");
    if (answers.validation) stack.push("Zod");
    if (answers.cors) stack.push("cors");
    if (answers.helmet) stack.push("helmet");
    stack.push("API rate limiting");
    if (answers.auth && answers.refreshTokens) stack.push("Refresh-token helpers");
    if (answers.multer) stack.push("Multer (disk uploads)");
    if (answers.email) stack.push("Email delivery (Nodemailer/SMTP)");
    if (answers.socketio) stack.push("Socket.IO");
    if (answers.useLogger) stack.push(answers.loggerType.replace(" and ", " + "));
    if (answers.swagger) stack.push("Swagger");
    if (answers.dotenv) stack.push("dotenv");
    if (answers.nodemon) stack.push("nodemon");
    if (answers.lint) stack.push("ESLint + Prettier");
    if (answers.test) stack.push("Vitest + Supertest");

    return stack;
}

function getDatabaseSteps(answers) {
    if (answers.orm === "Prisma") {
        return `
4. Add models to \`prisma/schema.prisma\`, then create and apply a migration:

\`\`\`bash
npm run db:migrate
npm run db:generate
\`\`\`
`;
    }

    if (answers.orm === "Drizzle") {
        return `
4. Define tables in \`src/database/schema.js\`, then generate and apply migrations:

\`\`\`bash
npm run db:generate
npm run db:migrate
\`\`\`
`;
    }

    if (answers.orm === "TypeORM") {
        return `
4. Add entity files under \`src/models/\`, generate a migration, then apply it:

\`\`\`bash
npm run db:migration:generate
npm run db:migrate
\`\`\`
`;
    }

    if (answers.orm === "Sequelize") {
        const createDatabase = answers.database === "SQLite" ? "" : "npx sequelize-cli db:create\n";
        return `
4. Create the database if needed, then run migrations:

\`\`\`bash
${createDatabase}npm run db:migrate
\`\`\`

The project uses ES modules, but the Sequelize CLI-generated model and migration files remain CommonJS.
`;
    }

    return "";
}

function getUploadSection(answers) {
    if (!answers.multer) {
        return "";
    }

    return `## File uploads

The generated Multer middleware stores files in \`UPLOAD_DIR\` (default: \`uploads/\`), assigns
random filenames, and limits each file to \`UPLOAD_MAX_FILE_SIZE_MB\` (default: 5 MB) with at most
five files per request. Use it on routes like this:

\`\`\`js
import { upload } from "#middlewares/upload.middleware";

router.post("/upload", upload.single("file"), (req, res) => {
    res.status(201).json({ file: req.file });
});
\`\`\`

Multer reports invalid multipart requests as HTTP 400 and oversized files as HTTP 413 through the
generated error middleware.
`;
}

function getEmailSection(answers) {
    if (!answers.email) {
        return "";
    }

    return `## Email delivery

Configure \`SMTP_HOST\`, \`SMTP_PORT\`, \`SMTP_SECURE\`, and \`SMTP_FROM\` in \`.env\`. Set
\`SMTP_USER\` and \`SMTP_PASSWORD\` together when your SMTP server requires authentication.
Use port 465 with \`SMTP_SECURE=true\`, or port 587 with \`SMTP_SECURE=false\`, as required by
your provider. Replace the example host and sender address with values from your mail provider.

Send email from application code with the generated service:

\`\`\`js
import { sendEmail } from "#services/email.service";

await sendEmail({
    to: "user@example.com",
    subject: "Welcome",
    text: "Thanks for signing up.",
});
\`\`\`

`;
}

function getApiSection(answers) {
    const rows = ["| GET | \`/api/health\` | Health check |"];

    if (answers.swagger) {
        rows.push("| GET | \`/api/docs\` | Swagger UI |");
    }

    return `## API

| Method | Path | Description |
|---|---|---|
${rows.join("\n")}

`;
}

function getRateLimitingSection(answers) {
    const storage = answers.redis
        ? "Request counts are stored in Redis and shared between application instances."
        : "Request counts are kept in memory per application instance and reset when it restarts. If you run multiple instances, select Redis for shared limits.";

    return `## API rate limiting

The generated app limits each client IP to 100 requests per 15 minutes across \`/api\` routes.
The \`/api/health\` endpoint is excluded. Edit \`src/config/rate-limit.config.js\` to change the
window or request limit. ${storage}

If you deploy behind a reverse proxy or load balancer, configure Express \`trust proxy\` to match
your hosting setup so the limiter can identify client IP addresses correctly. Trust only the
proxies you control; do not enable trust for arbitrary forwarded addresses.

Excess requests receive HTTP 429 (Too Many Requests).

`;
}

function getRefreshTokenSection(answers) {
    if (!answers.auth || !answers.refreshTokens) {
        return "";
    }

    return `## Refresh-token helpers

The generated \`src/utils/jwt.js\` provides functions to sign and verify refresh JWTs.
The \`.env\` file contains a separate randomly generated \`JWT_REFRESH_SECRET\` and
\`JWT_REFRESH_EXPIRES_IN\` defaults to \`7d\`. Keep the refresh secret private and different from
\`JWT_SECRET\`.

These are helpers only: the project must decide how to securely store refresh sessions, rotate or
revoke tokens, and expose refresh/logout endpoints. A signed JWT cannot be revoked by these helpers
alone. See \`src/utils/jwt.js\` for the available functions.

`;
}

function getSocketIoSection(answers) {
    if (!answers.socketio) {
        return "";
    }

    const authNote = answers.auth
        ? "The generated Socket.IO middleware requires a JWT in the handshake auth payload (`auth: { token }`)."
        : "Socket connections are not authenticated by default; add authentication and authorization before using this in production.";

    return `## Real-time events

Socket.IO is attached to the same server and port as the API. Its allowed origin is configured with
\`CORS_ORIGIN\` in \`.env\`. The generated server emits a \`connection:ready\` event when a client connects.

${authNote}

Install \`socket.io-client\` in your frontend to connect, then add event handlers in
\`src/config/socket.js\`.

`;
}

function getScriptsSection(answers) {
    const commands = [
        ["npm run dev", "Start the development server"],
        ["npm start", "Start the server"],
    ];
    if (answers.lint) {
        commands.push(
            ["npm run lint", "Check the code with ESLint"],
            ["npm run lint:fix", "Fix ESLint problems that can be fixed automatically"],
            ["npm run format", "Format all files with Prettier"],
            ["npm run format:check", "Check formatting without changing files"]
        );
    }
    if (answers.orm === "Prisma") {
        commands.push(
            ["npm run db:migrate", "Create and apply a Prisma migration"],
            ["npm run db:generate", "Generate the Prisma client"]
        );
    } else if (answers.orm === "Drizzle") {
        commands.push(
            ["npm run db:generate", "Generate database migrations"],
            ["npm run db:migrate", "Apply database migrations"]
        );
    } else if (answers.orm === "TypeORM") {
        commands.push(
            ["npm run db:migration:generate", "Generate a TypeORM migration"],
            ["npm run db:migrate", "Apply database migrations"]
        );
    } else if (answers.orm === "Sequelize") {
        commands.push(
            ["npm run db:migrate", "Apply Sequelize migrations"],
            ["npm run db:seed", "Run Sequelize seeders"]
        );
    }

    return `## Scripts

| Command | What it does |
|---|---|
${commands.map(([command, description]) => `| \`${command}\` | ${description} |`).join("\n")}

`;
}

function getReadme(answers, projectName, folders) {
    const stack = getStack(answers);
    const stackSection =
        stack.length > 0 ? `## Stack\n\n${stack.map((item) => `- ${item}`).join("\n")}\n\n` : "";
    const envNote = answers.auth
        ? ` It includes randomly generated JWT secret${answers.refreshTokens ? "s" : ""}. Keep \`.env.example\` as a reference; copying it over \`.env\` would replace ${answers.refreshTokens ? "them" : "it"} with placeholder values.`
        : " Keep `.env.example` as a reference.";

    const folderList = folders
        .map((folder, i) => `    ${i === folders.length - 1 ? "└──" : "├──"} ${folder}/`)
        .join("\n");
    const testsFolder = answers.test ? "├── tests/\n" : "";

    return `# ${projectName}

${stackSection}## Getting started

1. Install dependencies:

\`\`\`bash
npm install
\`\`\`

2. Review the generated \`.env\` file and update its values as needed.${envNote}

3. Start the development server:

\`\`\`bash
npm run dev
\`\`\`
${getDatabaseSteps(answers)}
${getApiSection(answers)}${getRateLimitingSection(answers)}${getRefreshTokenSection(answers)}${getUploadSection(answers)}${getEmailSection(answers)}${getSocketIoSection(answers)}${getScriptsSection(answers)}## Project structure

\`\`\`
${projectName}/
${testsFolder}└── src/
    ├── app.js        # builds the Express app
    ├── server.js     # starts the server
${folderList}
\`\`\`
`;
}

module.exports = { getReadme };
