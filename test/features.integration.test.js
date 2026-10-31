const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
    createGeneratedProject,
    findFreePort,
    run,
    startGeneratedServer,
    stopGeneratedServer,
    waitForHealth,
} = require("./helpers/generated-project");

test(
    "Redis-backed health test does not require Redis to be running",
    { timeout: 600_000 },
    async (t) => {
        const project = await createGeneratedProject({
            database: "None",
            dotenv: true,
            redis: true,
            test: true,
        });
        t.after(() => project.cleanup());

        const result = spawnSync(
            process.platform === "win32" ? "npm.cmd" : "npm",
            ["test"],
            {
                cwd: project.directory,
                encoding: "utf8",
                timeout: 120_000,
            }
        );

        assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
        assert.doesNotMatch(result.stderr, /express-rate-limit: async error during store initialization/);
        assert.match(result.stdout, /Test Files\s+1 passed/);
    }
);

test(
    "generated Nodemailer service loads SMTP configuration without connecting immediately",
    { timeout: 600_000 },
    async (t) => {
        const project = await createGeneratedProject({
            database: "None",
            dotenv: true,
            email: true,
        });
        t.after(() => project.cleanup());

        const output = run(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `import assert from "node:assert/strict";
import env from "#config/env";
import { sendEmail } from "#services/email.service";

assert.equal(env.SMTP_HOST, "smtp.example.com");
assert.equal(env.SMTP_PORT, 587);
assert.equal(env.SMTP_SECURE, false);
assert.equal(typeof sendEmail, "function");
console.log("Nodemailer service loaded");
`,
            ],
            project.directory
        );

        assert.match(output, /Nodemailer service loaded/);

        fs.appendFileSync(path.join(project.directory, ".env"), "\nSMTP_USER=test-user\n");
        assert.throws(
            () =>
                run(
                    process.execPath,
                    ["--input-type=module", "-e", 'import "#services/email.service";'],
                    project.directory
                ),
            /SMTP_USER and SMTP_PASSWORD must both be set/
        );
    }
);

test(
    "JWT-protected Socket.IO feature connects, emits ready, and rejects unauthenticated clients",
    { timeout: 600_000 },
    async (t) => {
        const project = await createGeneratedProject(
            {
                database: "None",
                cors: false,
                auth: true,
                socketio: true,
            },
            { extraDependencies: ["socket.io-client"] }
        );
        t.after(() => project.cleanup());

        const clientScript = `import { io } from "socket.io-client";
import { signToken } from "./src/utils/jwt.js";

const mode = process.argv[2];
const options = { transports: ["websocket"], reconnection: false };
if (mode === "authenticated") {
    options.auth = { token: signToken({ id: "feature-test", role: "user" }) };
}

const socket = io(\`http://127.0.0.1:\${process.env.PORT}\`, options);
const timeout = setTimeout(() => {
    console.error("Timed out waiting for Socket.IO handshake");
    process.exit(1);
}, 10000);

socket.on("connect_error", (error) => {
    clearTimeout(timeout);
    if (mode === "unauthenticated" && error.message === "Authentication required") {
        console.log("unauthenticated connection rejected");
        socket.disconnect();
        process.exit(0);
    }
    console.error(error.message);
    process.exit(1);
});

socket.on("connection:ready", (payload) => {
    clearTimeout(timeout);
    if (mode !== "authenticated" || !payload.socketId) {
        console.error("Unexpected connection:ready payload");
        process.exit(1);
    }
    console.log("authenticated connection ready");
    socket.disconnect();
    process.exit(0);
});
`;
        fs.writeFileSync(path.join(project.directory, "socket-smoke.mjs"), clientScript);

        const port = await findFreePort();
        const server = startGeneratedServer(project.directory, port);
        t.after(() => stopGeneratedServer(server));
        await waitForHealth(server, port);

        for (const mode of ["authenticated", "unauthenticated"]) {
            const result = run(
                process.execPath,
                ["socket-smoke.mjs", mode],
                project.directory,
                { env: { PORT: String(port) }, timeout: 20_000 }
            );
            assert.match(result, new RegExp(`${mode} connection (ready|rejected)`));
        }
    }
);

test(
    "rate limiting applies to API routes but does not count health checks",
    { timeout: 600_000 },
    async (t) => {
        const project = await createGeneratedProject({
            database: "None",
        });
        t.after(() => project.cleanup());

        fs.writeFileSync(
            path.join(project.directory, "src/config/rate-limit.config.js"),
            `export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 2;
`
        );

        const port = await findFreePort();
        const server = startGeneratedServer(project.directory, port);
        t.after(() => stopGeneratedServer(server));
        await waitForHealth(server, port);

        for (let request = 0; request < 4; request++) {
            const response = await fetch(`http://127.0.0.1:${port}/api/health`);
            assert.equal(response.status, 200);
        }

        const apiStatuses = [];
        for (let request = 0; request < 3; request++) {
            const response = await fetch(`http://127.0.0.1:${port}/api/rate-limit-test`);
            apiStatuses.push(response.status);
        }
        assert.deepEqual(apiStatuses, [404, 404, 429]);

        const healthAfterLimit = await fetch(`http://127.0.0.1:${port}/api/health`);
        assert.equal(healthAfterLimit.status, 200);
    }
);

test(
    "refresh-token helpers sign and verify only refresh tokens",
    { timeout: 600_000 },
    async (t) => {
        const project = await createGeneratedProject({
            database: "None",
            dotenv: true,
            auth: true,
            refreshTokens: true,
        });
        t.after(() => project.cleanup());

        const scriptPath = path.join(project.directory, "refresh-token-smoke.mjs");
        fs.writeFileSync(
            scriptPath,
            `            import assert from "node:assert/strict";
            import { signToken, signRefreshToken, verifyRefreshToken } from "./src/utils/jwt.js";

const user = { id: "refresh-test-user", role: "user" };
const refreshToken = signRefreshToken(user);
const payload = verifyRefreshToken(refreshToken);
assert.equal(payload.sub, user.id);
assert.equal(payload.tokenType, "refresh");
assert.throws(() => verifyRefreshToken(signToken(user)));
assert.throws(() => verifyRefreshToken(\`\${refreshToken}tampered\`));
console.log("refresh-token helper smoke test passed");
`
        );

        const output = run(process.execPath, [scriptPath], project.directory);
        assert.match(output, /refresh-token helper smoke test passed/);
    }
);
