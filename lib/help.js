const pc = require("picocolors");

// Width of the left column (names), so descriptions line up
const COLUMN_WIDTH = 20;

function row(name, description) {
    return `  ${pc.cyan(name.padEnd(COLUMN_WIDTH))}${description}`;
}

// Second and later lines of a long description
function continued(description) {
    return `  ${" ".repeat(COLUMN_WIDTH)}${description}`;
}

function getHelpText(version) {
    return [
        `${pc.bold(pc.green("APIForge"))} ${pc.dim(`v${version}`)}`,
        "Scaffold a Node.js backend (Express, ES modules) with the tools you pick.",
        "",
        pc.bold("Usage:"),
        `  ${pc.cyan("apiforge")} [project-name] [options]`,
        "",
        pc.bold("Arguments:"),
        row("project-name", "Folder to create. Use letters, numbers, '.', '-' and '_'."),
        continued("If you leave it out, you will be asked for it."),
        "",
        pc.bold("Options:"),
        row("-h, --help", "Show this help message"),
        row("-v, --version", "Show the version number"),
        "",
        pc.bold("What you can choose (you will be asked one by one):"),
        row("Database", "MongoDB, PostgreSQL, MySQL, SQLite or none"),
        row("ORM", "Prisma, Drizzle, TypeORM or Sequelize (SQL databases)"),
        row("Features", "JWT auth, Bcrypt, Zod, CORS, Helmet, Multer, Nodemailer,"),
        continued("Swagger, Socket.IO, Redis, ESLint + Prettier,"),
        continued("Vitest + Supertest, Dotenv, Nodemon"),
        row("Logger", "Pino, Winston, Morgan, or Pino/Winston + Morgan"),
        "",
        pc.bold("Examples:"),
        row("apiforge my-api", "Create 'my-api' and ask what to include"),
        row("apiforge", "Ask for the project name, then what to include"),
        row("apiforge --version", "Show the version number"),
        "",
        pc.bold("Good to know:"),
        "  - Needs Node.js 20.19+ or 22.12+",
        "  - Press Ctrl+C at any time: an unfinished project folder is removed",
        "  - Generated code uses ES modules and imports like #config/env",
    ].join("\n");
}

module.exports = { getHelpText };
