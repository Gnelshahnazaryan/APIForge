const p = require("@clack/prompts");
const pc = require("picocolors");

const { runCommand } = require("./run-command");
const { updatePackageJson } = require("./package-json");
const { setupSequelize } = require("./sequelize");
const { setupPrisma } = require("./prisma");

function getDependencies(answers) {
    const dependencies = [];
    const devDependencies = [];

    if (answers.express) {
        dependencies.push("express");
    }

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

    if (answers.nodemon) {
        devDependencies.push("nodemon");
    }

    if (answers.database === "MongoDB") {
        dependencies.push("mongoose");
    }

    if (answers.database === "PostgreSQL") {
        dependencies.push("pg");

        if (answers.postgresOrm === "Prisma") {
            // Pinned so CLI and client match: npm's "latest" tag for prisma
            // has pointed to a release candidate while @prisma/client was still on 7.x
            dependencies.push("@prisma/client@7", "@prisma/adapter-pg@7");
            devDependencies.push("prisma@7");

            // prisma7.config.ts (created by prisma init) imports "dotenv/config"
            if (!answers.dotenv) {
                dependencies.push("dotenv");
            }
        }

        if (answers.postgresOrm === "Sequelize") {
            dependencies.push("sequelize", "pg-hstore");
            devDependencies.push("sequelize-cli");
        }
    }

    if (answers.redis) {
        dependencies.push("redis");
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

// "@prisma/client@7" → "@prisma/client" for display
function names(packages) {
    return packages.map((pkg) => pkg.replace(/(.)@.*$/, "$1")).join(", ");
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

async function installPackages(projectPath, answers) {
    const { dependencies, devDependencies } = getDependencies(answers);

    await step("Creating package.json", "Created package.json", async () => {
        await runCommand("npm init -y", projectPath);
        updatePackageJson(projectPath, answers.nodemon);
    });

    if (dependencies.length > 0) {
        await step(
            `Installing ${plural(dependencies.length, "package")}`,
            `Installed ${names(dependencies)}`,
            () => runCommand(`npm install ${dependencies.join(" ")}`, projectPath)
        );
    }

    if (devDependencies.length > 0) {
        await step(
            `Installing ${plural(devDependencies.length, "dev package")}`,
            `Installed ${names(devDependencies)} ${pc.dim("(dev)")}`,
            () => runCommand(`npm install -D ${devDependencies.join(" ")}`, projectPath)
        );
    }

    if (answers.database === "PostgreSQL" && answers.postgresOrm === "Prisma") {
        await step("Setting up Prisma", "Set up Prisma", () =>
            setupPrisma(projectPath)
        );
    } else if (answers.database === "PostgreSQL" && answers.postgresOrm === "Sequelize") {
        await step("Setting up Sequelize", "Set up Sequelize", () =>
            setupSequelize(projectPath)
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

module.exports = { installPackages };
