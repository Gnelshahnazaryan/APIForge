const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const { createStructure } = require("../../lib/structure");
const { getDependencies } = require("../../lib/installer");
const { updatePackageJson } = require("../../lib/package-json");
const { setupPrisma } = require("../../lib/prisma");
const { setupDrizzle } = require("../../lib/drizzle");
const { setupSequelize } = require("../../lib/sequelize");

function run(command, args, cwd, options = {}) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        shell: process.platform === "win32",
        timeout: options.timeout ?? 600_000,
        env: { ...process.env, ...options.env },
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(" ")} failed (exit ${result.status})\n${result.stdout}${result.stderr}`
        );
    }

    return result.stdout;
}

function npm(args, cwd, options) {
    return run(process.platform === "win32" ? "npm.cmd" : "npm", args, cwd, options);
}

async function createGeneratedProject(answers, { extraDependencies = [] } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "api-forge-test-"));
    let keepDirectory = false;

    try {
        createStructure(directory, answers);
        npm(["init", "-y"], directory);

        const { dependencies, devDependencies } = getDependencies(answers);
        const allDependencies = [...new Set([...dependencies, ...extraDependencies])];

        if (allDependencies.length > 0) {
            npm(["install", "--no-audit", "--no-fund", ...allDependencies], directory);
        }

        if (devDependencies.length > 0) {
            npm(["install", "--save-dev", "--no-audit", "--no-fund", ...devDependencies], directory);
        }

        updatePackageJson(directory, answers);

        if (answers.orm === "Prisma") {
            await setupPrisma(directory, answers);
        } else if (answers.orm === "Drizzle") {
            await setupDrizzle(directory, answers);
        } else if (answers.orm === "Sequelize") {
            await setupSequelize(directory, answers);
        }

        return {
            directory,
            cleanup() {
                fs.rmSync(directory, { recursive: true, force: true });
            },
            keep() {
                keepDirectory = true;
            },
        };
    } catch (error) {
        if (!keepDirectory) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
        throw error;
    }
}

function findFreePort() {
    const net = require("node:net");

    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close((error) => (error ? reject(error) : resolve(port)));
        });
    });
}

function startGeneratedServer(directory, port) {
    const child = spawn(process.execPath, ["src/server.js"], {
        cwd: directory,
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
        output += chunk;
    });
    child.stderr.on("data", (chunk) => {
        output += chunk;
    });

    return { child, getOutput: () => output };
}

async function waitForHealth(server, port, { timeout = 20_000 } = {}) {
    const deadline = Date.now() + timeout;
    let lastError;

    while (Date.now() < deadline) {
        if (server.child.exitCode !== null) {
            throw new Error(`Generated server exited early.\n${server.getOutput()}`);
        }

        try {
            const response = await fetch(`http://127.0.0.1:${port}/api/health`);
            if (response.ok) {
                return await response.json();
            }
            lastError = new Error(`Health endpoint returned HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(
        `Generated server did not become healthy within ${timeout} ms: ${lastError}\n${server.getOutput()}`
    );
}

async function stopGeneratedServer(server) {
    if (server.child.exitCode !== null) {
        return;
    }

    server.child.kill("SIGTERM");
    await Promise.race([
        new Promise((resolve) => server.child.once("close", resolve)),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);

    if (server.child.exitCode === null) {
        server.child.kill("SIGKILL");
    }
}

module.exports = {
    createGeneratedProject,
    findFreePort,
    npm,
    run,
    startGeneratedServer,
    stopGeneratedServer,
    waitForHealth,
};
