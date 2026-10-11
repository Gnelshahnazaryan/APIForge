const p = require("@clack/prompts");

function exitIfCancelled(value) {
    if (p.isCancel(value)) {
        p.cancel("Operation cancelled. Nothing was created.");
        process.exit(0);
    }

    return value;
}

async function askProjectName(validate) {
    return exitIfCancelled(await p.text({
        message: "Project name",
        placeholder: "my-api",
        validate: (value) => validate(value ?? ""),
    }));
}

async function askQuestions() {
    const database = exitIfCancelled(await p.select({
        message: "Database",
        options: [
            { value: "MongoDB", label: "MongoDB", hint: "mongoose" },
            { value: "PostgreSQL", label: "PostgreSQL" },
            { value: "None", label: "None" },
        ],
    }));

    let postgresOrm;

    if (database === "PostgreSQL") {
        postgresOrm = exitIfCancelled(await p.select({
            message: "PostgreSQL ORM",
            options: [
                { value: "Prisma", label: "Prisma" },
                { value: "Sequelize", label: "Sequelize" },
            ],
        }));
    }

    const features = exitIfCancelled(await p.multiselect({
        message: "Features",
        options: [
            { value: "express", label: "Express" },
            { value: "dotenv", label: "dotenv", hint: "load .env" },
            { value: "nodemon", label: "nodemon", hint: "restart on change" },
            { value: "auth", label: "JWT auth", hint: "jsonwebtoken + cookie-parser" },
            { value: "bcrypt", label: "bcrypt", hint: "password hashing" },
            { value: "validation", label: "Zod", hint: "request validation" },
            { value: "cors", label: "cors" },
            { value: "helmet", label: "helmet", hint: "security headers" },
            { value: "swagger", label: "Swagger", hint: "API docs" },
            { value: "redis", label: "Redis" },
        ],
        initialValues: ["express", "dotenv", "nodemon", "validation", "cors", "helmet"],
        required: false,
    }));

    const loggerType = exitIfCancelled(await p.select({
        message: "Logger",
        options: [
            { value: "None", label: "None" },
            { value: "Pino", label: "Pino" },
            { value: "Winston", label: "Winston" },
            { value: "Morgan", label: "Morgan", hint: "HTTP request logs" },
            { value: "Pino and Morgan", label: "Pino + Morgan" },
            { value: "Winston and Morgan", label: "Winston + Morgan" },
        ],
    }));

    const openInVSCode = exitIfCancelled(await p.confirm({
        message: "Open the project in VS Code when done?",
        initialValue: false,
    }));

    const answers = {
        database,
        postgresOrm,
        useLogger: loggerType !== "None",
        loggerType,
        openInVSCode,
    };

    for (const feature of features) {
        answers[feature] = true;
    }

    return answers;
}

module.exports = { askQuestions, askProjectName };
