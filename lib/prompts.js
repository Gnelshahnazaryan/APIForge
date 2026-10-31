const p = require("@clack/prompts");

function exitIfCancelled(value) {
    if (p.isCancel(value)) {
        p.cancel("Operation cancelled. Nothing was created.");
        process.exit(0);
    }

    return value;
}

async function askProjectName(validate) {
    return exitIfCancelled(
        await p.text({
            message: "Project name",
            placeholder: "my-api",
            validate: (value) => validate(value ?? ""),
        })
    );
}

async function askQuestions() {
    const database = exitIfCancelled(
        await p.select({
            message: "Database",
            options: [
                { value: "MongoDB", label: "MongoDB", hint: "mongoose" },
                { value: "PostgreSQL", label: "PostgreSQL" },
                { value: "MySQL", label: "MySQL" },
                { value: "SQLite", label: "SQLite" },
                { value: "None", label: "None" },
            ],
        })
    );

    let orm;

    if (database === "PostgreSQL" || database === "MySQL" || database === "SQLite") {
        orm = exitIfCancelled(
            await p.select({
                message: "Database ORM",
                options: [
                    { value: "Prisma", label: "Prisma" },
                    { value: "Drizzle", label: "Drizzle" },
                    { value: "TypeORM", label: "TypeORM" },
                    { value: "Sequelize", label: "Sequelize" },
                ],
            })
        );
    }

    const features = exitIfCancelled(
        await p.multiselect({
            message: "Features",
            options: [
                { value: "dotenv", label: "Dotenv", hint: "load .env" },
                { value: "nodemon", label: "Nodemon", hint: "restart on change" },
                { value: "auth", label: "Authentication", hint: "jsonwebtoken + cookie-parser" },
                { value: "bcrypt", label: "Bcrypt", hint: "password hashing" },
                { value: "validation", label: "Zod", hint: "request validation" },
                { value: "cors", label: "Cors" },
                { value: "helmet", label: "Helmet", hint: "security headers" },
                { value: "multer", label: "Multer", hint: "multipart/form-data handling" },
                { value: "email", label: "Nodemailer", hint: "email delivery" },
                { value: "swagger", label: "Swagger", hint: "API docs" },
                { value: "socketio", label: "Socket.IO", hint: "real-time events" },
                { value: "redis", label: "Redis", hint: "caching" },
                { value: "lint", label: "ESLint + Prettier", hint: "lint and format" },
                { value: "test", label: "Vitest + Supertest", hint: "testing" },
            ],
            initialValues: ["dotenv", "nodemon", "cors", "helmet", "lint"],
            required: false,
        })
    );

    const refreshTokens = features.includes("auth")
        ? exitIfCancelled(
              await p.confirm({
                  message: "Generate refresh-token helpers?",
                  initialValue: false,
              })
          )
        : false;

    const loggerType = exitIfCancelled(
        await p.select({
            message: "Logger",
            options: [
                { value: "None", label: "None" },
                { value: "Pino", label: "Pino" },
                { value: "Winston", label: "Winston" },
                { value: "Morgan", label: "Morgan", hint: "HTTP request logs" },
                { value: "Pino and Morgan", label: "Pino + Morgan" },
                { value: "Winston and Morgan", label: "Winston + Morgan" },
            ],
        })
    );

    const openInVSCode = exitIfCancelled(
        await p.confirm({
            message: "Open the project in VS Code when done?",
            initialValue: false,
        })
    );

    const answers = {
        database,
        orm,
        useLogger: loggerType !== "None",
        loggerType,
        openInVSCode,
        refreshTokens,
    };

    for (const feature of features) {
        answers[feature] = true;
    }

    return answers;
}

module.exports = { askQuestions, askProjectName };
