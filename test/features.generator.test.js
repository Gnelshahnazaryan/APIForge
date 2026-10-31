const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const { getAppFiles } = require("../lib/app-files");
const { getConnectionFiles } = require("../lib/connections");
const { getEnvFiles } = require("../lib/env");
const { getDependencies } = require("../lib/installer");
const { getLintFiles } = require("../lib/lint-files");
const { getReadme } = require("../lib/readme");

function assertValidModule(source, filePath) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
        input: source,
        encoding: "utf8",
    });

    assert.equal(result.status, 0, `${filePath}\n${result.stderr}`);
}

test("generates syntactically valid files and dependencies for the full Express feature set", () => {
    const answers = {
        database: "None",
        dotenv: true,
        nodemon: true,
        auth: true,
        refreshTokens: true,
        bcrypt: true,
        validation: true,
        cors: true,
        helmet: true,
        multer: true,
        email: true,
        swagger: true,
        socketio: true,
        redis: true,
        lint: true,
        test: true,
        useLogger: true,
        loggerType: "Pino and Morgan",
    };
    const envFiles = getEnvFiles(answers, "feature-test");
    const files = [
        ...getAppFiles(answers, "feature-test"),
        ...getConnectionFiles(answers),
        ...getLintFiles(answers),
        { path: "src/config/env.js", content: envFiles.module },
        { path: "src/constants/env.constants.js", content: envFiles.constants },
    ];

    for (const file of files) {
        if (file.path.endsWith(".js")) {
            assertValidModule(file.content, file.path);
        }
    }

    const { dependencies, devDependencies } = getDependencies(answers);
    for (const dependency of [
        "express",
        "express-rate-limit",
        "jsonwebtoken",
        "bcrypt",
        "zod",
        "cors",
        "helmet",
        "multer",
        "nodemailer",
        "swagger-jsdoc",
        "socket.io",
        "redis",
        "pino",
        "morgan",
    ]) {
        assert.ok(dependencies.includes(dependency), `Missing dependency ${dependency}`);
    }
    assert.ok(devDependencies.includes("nodemon"));
    assert.ok(devDependencies.includes("vitest"));
    assert.ok(devDependencies.includes("eslint"));

    assert.ok(dependencies.includes("rate-limit-redis"));
    assert.ok(files.some(({ path }) => path === "src/utils/jwt.js"));
    assert.ok(!files.some(({ path }) => path === "src/utils/refresh-token.js"));
    assert.ok(files.some(({ path }) => path === "src/services/email.service.js"));
    assert.match(envFiles.example, /^SMTP_HOST=smtp\.example\.com$/m);
    assert.match(envFiles.example, /^SMTP_PORT=587$/m);
    assert.match(envFiles.example, /^SMTP_SECURE=false$/m);
    assert.match(envFiles.example, /^SMTP_FROM=no-reply@example\.com$/m);
    assert.match(envFiles.constants, /"SMTP_HOST"/);
    assert.match(envFiles.constants, /"SMTP_FROM"/);
    assert.match(getReadme(answers, "feature-test", []), /Email delivery/);
    assert.match(getReadme(answers, "feature-test", []), /sendEmail/);
});

test("keeps Nodemailer, SMTP settings, and mail service optional", () => {
    const answers = { database: "None" };
    const dependencies = getDependencies(answers).dependencies;
    const files = getAppFiles(answers, "no-email-test");
    const env = getEnvFiles(answers, "no-email-test");
    const readme = getReadme(answers, "no-email-test", []);

    assert.ok(!dependencies.includes("nodemailer"));
    assert.ok(!files.some(({ path }) => path === "src/services/email.service.js"));
    assert.doesNotMatch(env.example, /^SMTP_/m);
    assert.doesNotMatch(env.constants, /SMTP_/);
    assert.doesNotMatch(readme, /Email delivery/);
});

test("generates refresh-token environment settings and documents helper-only scope", () => {
    const answers = { database: "None", auth: true, refreshTokens: true };
    const env = getEnvFiles(answers, "refresh-test");
    const jwtFile = getAppFiles(answers, "refresh-test").find(
        ({ path }) => path === "src/utils/jwt.js"
    );
    const readme = getReadme(answers, "refresh-test", []);
    const secret = (content) => content.match(/^JWT_REFRESH_SECRET=(.+)$/m)?.[1];

    assert.ok(secret(env.env));
    assert.notEqual(secret(env.env), secret(env.example));
    assert.match(env.example, /^JWT_REFRESH_EXPIRES_IN=7d$/m);
    assert.match(env.constants, /REQUIRED_ENV_VARS = Object\.freeze\(/);
    assert.match(env.constants, /"JWT_REFRESH_SECRET"/);
    assert.match(env.module, /import \{ REQUIRED_ENV_VARS \} from "#constants\/env\.constants"/);
    assert.doesNotMatch(env.module, /const REQUIRED_ENV_VARS/);
    assert.match(jwtFile.content, /jwt\.sign/);
    assert.match(jwtFile.content, /jwt\.verify/);
    assert.match(jwtFile.content, /tokenType: "refresh"/);
    assert.doesNotMatch(jwtFile.content, /#utils\/refresh-token/);
    assert.match(readme, /helpers only/);
    assert.match(readme, /rotate or\s+revoke tokens/);

    const withoutRefresh = getEnvFiles(
        { database: "None", auth: true },
        "refresh-test"
    );
    assert.doesNotMatch(withoutRefresh.env, /JWT_REFRESH_/);
    assert.doesNotMatch(withoutRefresh.example, /JWT_REFRESH_/);
    assert.doesNotMatch(withoutRefresh.constants, /JWT_REFRESH_/);

    const withoutAuth = getAppFiles(
        { database: "None", auth: false, refreshTokens: true },
        "refresh-test"
    );
    const jwtWithoutAuth = withoutAuth.find(({ path }) => path === "src/utils/jwt.js");
    assert.ok(!jwtWithoutAuth);
});

test("generates configurable rate limiting for Express and excludes the health route", () => {
    const expressAnswers = { database: "None" };
    const files = getAppFiles(expressAnswers, "rate-limit-test");
    const app = files.find(({ path }) => path === "src/app.js").content;
    const config = files.find(({ path }) => path === "src/config/rate-limit.config.js");
    const middleware = files.find(
        ({ path }) => path === "src/middlewares/rate-limit.middleware.js"
    );
    const memoryDependencies = getDependencies(expressAnswers).dependencies;

    assert.ok(config);
    assert.ok(middleware);
    assert.match(config.content, /RATE_LIMIT_WINDOW_MS = 15 \* 60 \* 1000/);
    assert.match(config.content, /RATE_LIMIT_MAX_REQUESTS = 100/);
    assert.match(middleware.content, /skip: \(req\) => req\.path === "\/health"/);
    assert.match(app, /app\.use\("\/api", rateLimiter\)/);
    assert.match(app, /app\.use\(express\.urlencoded\(\{ extended: true \}\)\)/);
    assert.ok(memoryDependencies.includes("express-rate-limit"));
    assert.ok(!memoryDependencies.includes("rate-limit-redis"));

    const redisAnswers = { ...expressAnswers, redis: true };
    const redisMiddleware = getAppFiles(redisAnswers, "rate-limit-test").find(
        ({ path }) => path === "src/middlewares/rate-limit.middleware.js"
    ).content;
    const redisDependencies = getDependencies(redisAnswers).dependencies;

    assert.match(redisMiddleware, /new RedisStore/);
    assert.match(redisMiddleware, /redis\.sendCommand\(args\)/);
    assert.ok(redisDependencies.includes("rate-limit-redis"));
    assert.ok(redisDependencies.includes("redis"));
    assert.match(getReadme(expressAnswers, "rate-limit-test", []), /proxy or load balancer/);
    assert.match(getReadme(redisAnswers, "rate-limit-test", []), /shared between application instances/);
    assert.match(getReadme(expressAnswers, "rate-limit-test", []), /\/api\/health.*excluded/s);

    const legacyNoExpressAnswers = { database: "None", express: false, test: true };
    assert.ok(getDependencies(legacyNoExpressAnswers).dependencies.includes("express"));
    assert.ok(getDependencies(legacyNoExpressAnswers).dependencies.includes("express-rate-limit"));
    assert.ok(
        getAppFiles(legacyNoExpressAnswers, "express-test").some(
            ({ path }) => path === "tests/health.test.js"
        )
    );

    const redisHealthTest = getAppFiles(
        { database: "None", redis: true, test: true },
        "redis-test"
    ).find(({ path }) => path === "tests/health.test.js").content;
    assert.match(redisHealthTest, /vi\.mock\("#middlewares\/rate-limit\.middleware"/);
});

test("generates Express output with JWT-protected Socket.IO", () => {
    const answers = {
        database: "None",
        auth: true,
        socketio: true,
    };

    for (const file of getAppFiles(answers, "plain-feature-test")) {
        if (file.path.endsWith(".js")) {
            assertValidModule(file.content, file.path);
        }
    }
});
