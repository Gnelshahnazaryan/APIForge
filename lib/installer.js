const p = require("@clack/prompts");
const pc = require("picocolors");

const { runCommand } = require("./run-command");
const { updatePackageJson } = require("./package-json");
const { setupSequelize } = require("./sequelize");
const { setupPrisma } = require("./prisma");
const { setupDrizzle } = require("./drizzle");

function getDependencies(answers) {
    const dependencies = [];
    const devDependencies = [];

    dependencies.push("express", "express-rate-limit");

    if (answers.dotenv) {
        dependencies.push("dotenv");
    }

    if (answers.auth) {
        dependencies.push("jsonwebtoken", "cookie-parser");
    }

    if (answers.bcrypt) {
        dependencies.push("bcrypt");
    }

    if (answers.validation) {
        dependencies.push("zod");
    }

    if (answers.cors) {
        dependencies.push("cors");
    }

    if (answers.helmet) {
        dependencies.push("helmet");
    }

    if (answers.multer) {
        dependencies.push("multer");
    }

    if (answers.email) {
        dependencies.push("nodemailer");
    }

    if (answers.useLogger) {
        if (answers.loggerType === "Winston and Morgan") {
            dependencies.push("winston", "morgan");
        } else if (answers.loggerType === "Pino and Morgan") {
            dependencies.push("pino", "morgan");
        } else if (answers.loggerType === "Pino") {
            dependencies.push("pino");
        } else if (answers.loggerType === "Winston") {
            dependencies.push("winston");
        } else if (answers.loggerType === "Morgan") {
            dependencies.push("morgan");
        }
    }

    if (answers.swagger) {
        dependencies.push("swagger-jsdoc", "swagger-ui-express");
    }

    if (answers.socketio) {
        dependencies.push("socket.io");
    }

    if (answers.nodemon) {
        devDependencies.push("nodemon");
    }

    if (answers.database === "MongoDB") {
        dependencies.push("mongoose");
    }

    if (answers.database === "PostgreSQL") {
        dependencies.push("pg");
    }

    if (answers.database !== "MongoDB" && answers.database !== "None") {
        if (answers.orm === "Prisma") {
            dependencies.push("@prisma/client@7");
            devDependencies.push("prisma@7");

            if (answers.database === "PostgreSQL") {
                dependencies.push("@prisma/adapter-pg@7");
            } else if (answers.database === "MySQL") {
                dependencies.push("@prisma/adapter-mariadb@7", "mariadb");
            } else {
                dependencies.push("@prisma/adapter-better-sqlite3@7", "better-sqlite3");
            }

            if (!answers.dotenv) {
                dependencies.push("dotenv");
            }
        } else if (answers.orm === "Drizzle") {
            dependencies.push("drizzle-orm");
            devDependencies.push("drizzle-kit");
            if (answers.database === "MySQL") {
                dependencies.push("mysql2");
            } else if (answers.database === "SQLite") {
                dependencies.push("better-sqlite3");
            }
        } else if (answers.orm === "TypeORM") {
            dependencies.push("typeorm", "reflect-metadata");

            if (answers.database === "MySQL") {
                dependencies.push("mysql2");
            } else if (answers.database === "SQLite") {
                dependencies.push("better-sqlite3");
            }
        } else if (answers.orm === "Sequelize") {
            dependencies.push("sequelize");
            devDependencies.push("sequelize-cli");

            if (answers.database === "PostgreSQL") {
                dependencies.push("pg-hstore");
            } else if (answers.database === "MySQL") {
                dependencies.push("mysql2");
            } else {
                dependencies.push("sqlite3");
            }
        }
    }

    if (answers.redis) {
        dependencies.push("redis");
        dependencies.push("rate-limit-redis");
    }

    if (answers.lint) {
        devDependencies.push(
            "eslint",
            "@eslint/js",
            "globals",
            "prettier",
            "eslint-config-prettier"
        );
    }

    if (answers.test) {
        devDependencies.push("vitest", "supertest");
    }

    return { dependencies, devDependencies };
}

// Runs one step behind a spinner. On failure, shows the command output and exits.
async function step(message, doneMessage, task) {
    const spinner = p.spinner();
    const startedAt = Date.now();

    spinner.start(message);

    try {
        await task();
    } catch (err) {
        spinner.error(pc.red(`${message} failed`));

        if (err.output) {
            p.log.message(pc.dim(err.output));
        }

        p.cancel(pc.red(err.message.split("\n")[0]));
        process.exit(1);
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    spinner.stop(`${doneMessage} ${pc.dim(`(${seconds}s)`)}`);
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

async function installPackages(projectPath, answers) {
    const { dependencies, devDependencies } = getDependencies(answers);

    await step("Creating package.json", "Created package.json", async () => {
        await runCommand("npm init -y", projectPath);
        updatePackageJson(projectPath, answers);
    });

    if (dependencies.length > 0) {
        await step(
            `Installing ${plural(dependencies.length, "package")}`,
            "Dependencies installed successfully",
            () => runCommand(`npm install ${dependencies.join(" ")}`, projectPath)
        );
    }

    if (devDependencies.length > 0) {
        await step(
            `Installing ${plural(devDependencies.length, "dev package")}`,
            "Dev dependencies installed successfully",
            () => runCommand(`npm install -D ${devDependencies.join(" ")}`, projectPath)
        );
    }

    if (answers.orm === "Prisma") {
        await step("Setting up Prisma", "Set up Prisma", () => setupPrisma(projectPath, answers));
    } else if (answers.orm === "Drizzle") {
        await step("Setting up Drizzle", "Set up Drizzle", () =>
            setupDrizzle(projectPath, answers)
        );
    } else if (answers.orm === "Sequelize") {
        await step("Setting up Sequelize", "Set up Sequelize", () =>
            setupSequelize(projectPath, answers)
        );
    }

    // Last step, so files written by ORM CLIs get formatted too
    if (answers.lint) {
        await step("Formatting code", "Formatted code with Prettier", () =>
            runCommand("npx prettier --write .", projectPath)
        );
    }

    if (answers.openInVSCode) {
        try {
            await runCommand(`code "${projectPath}"`, projectPath);
            p.log.success("Opened in VS Code");
        } catch {
            p.log.warn("Could not open VS Code (is the 'code' command installed?)");
        }
    }
}

module.exports = { installPackages, getDependencies };
