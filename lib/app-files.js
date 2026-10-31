// Templates for src/app.js, src/server.js and the files they import.

function hasLoggerFile(answers) {
    return ["Pino", "Winston", "Pino and Morgan", "Winston and Morgan"].includes(
        answers.loggerType
    );
}

function usesMorgan(answers) {
    return ["Morgan", "Pino and Morgan", "Winston and Morgan"].includes(answers.loggerType);
}

// `log` is "logger" when a logger file exists, otherwise "console"
function getLog(answers) {
    return hasLoggerFile(answers) ? "logger" : "console";
}

function loggerImport(answers, fromFolder) {
    if (!hasLoggerFile(answers)) {
        return "";
    }

    return `import { logger } from "#utils/logger";\n`;
}

function getLoggerFile(answers) {
    if (answers.loggerType?.startsWith("Pino")) {
        return `import pino from "pino";
import env from "#config/env";

export const logger = pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
});
`;
    }

    return `import winston from "winston";
import env from "#config/env";

const isProduction = env.NODE_ENV === "production";

export const logger = winston.createLogger({
    level: isProduction ? "info" : "debug",
    format: isProduction
        ? winston.format.combine(winston.format.timestamp(), winston.format.json())
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    transports: [new winston.transports.Console()],
});
`;
}

function getSwaggerFile(projectName) {
    return `import swaggerJsdoc from "swagger-jsdoc";

// Routes are documented with @openapi comments in src/routes/*.js
export const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: { title: "${projectName} API", version: "1.0.0" },
        servers: [{ url: "/api" }],
    },
    apis: ["./src/routes/*.js"],
});
`;
}

function getEmailServiceFile() {
    return `import nodemailer from "nodemailer";
import env from "#config/env";

const auth = env.SMTP_USER || env.SMTP_PASSWORD
    ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
    : undefined;

if (auth && (!auth.user || !auth.pass)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must both be set when SMTP authentication is used");
}

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(auth ? { auth } : {}),
});

export function sendEmail({ to, subject, text, html }) {
    return transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        text,
        html,
    });
}
`;
}

function getRateLimitFiles(answers) {
    const store = answers.redis
        ? `import { RedisStore } from "rate-limit-redis";
import { redis } from "#config/redis";

const store = new RedisStore({
    sendCommand: (...args) => redis.sendCommand(args),
});
`
        : "";
    const storeOption = answers.redis ? "    store,\n" : "";

    return [
        {
            path: "src/config/rate-limit.config.js",
            content: `export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 100;
`,
        },
        {
            path: "src/middlewares/rate-limit.middleware.js",
            content: `import rateLimit from "express-rate-limit";
import {
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS,
} from "#config/rate-limit.config";
import { TooManyRequestsError } from "#errors/HttpErrors";
${store}
export const rateLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: "draft-8",
    legacyHeaders: false,
${storeOption}    skip: (req) => req.path === "/health",
    // Let the error handler build the response, so a 429 looks like every other error
    handler: (_req, _res, next) => next(new TooManyRequestsError()),
});
`,
        },
    ];
}

function getAppFile(answers) {
    const imports = [`import express from "express";`];
    const uses = [];

    if (answers.helmet) {
        imports.push(`import helmet from "helmet";`);
        uses.push(`app.use(helmet());`);
    }

    imports.push(`import { rateLimiter } from "#middlewares/rate-limit.middleware";`);

    if (answers.cors) {
        imports.push(`import cors from "cors";`);
        uses.push(`app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));`);
    }

    uses.push(`app.use("/api", rateLimiter);`);
    uses.push(`app.use(express.json());`);
    uses.push(`app.use(express.urlencoded({ extended: true }));`);

    if (answers.auth) {
        imports.push(`import cookieParser from "cookie-parser";`);
        uses.push(`app.use(cookieParser());`);
    }

    if (usesMorgan(answers)) {
        imports.push(`import morgan from "morgan";`);
        uses.push(`app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));`);
    }

    if (answers.swagger) {
        imports.push(`import swaggerUi from "swagger-ui-express";`);
        uses.push(`\napp.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));`);
    }

    // env is only read by the cors and morgan setup
    const localImports = [];

    if (answers.cors || usesMorgan(answers)) {
        localImports.push(`import env from "#config/env";`);
    }

    if (answers.swagger) {
        localImports.push(`import { swaggerSpec } from "#config/swagger";`);
    }

    localImports.push(
        `import routes from "#routes/index";`,
        `import { notFound } from "#middlewares/notFound.middleware";`,
        `import { errorHandler } from "#middlewares/error.middleware";`
    );

    return `${imports.join("\n")}

${localImports.join("\n")}

const app = express();

${uses.join("\n")}

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
`;
}

// How server.js connects to and disconnects from each service
function getServices(answers) {
    const services = [];

    if (answers.database === "MongoDB") {
        services.push({
            imports: `import { connectDatabase, disconnectDatabase } from "#config/database";`,
            connect: `await connectDatabase();`,
            disconnect: `await disconnectDatabase();`,
            name: "MongoDB",
        });
    }

    if (answers.orm === "Prisma") {
        services.push({
            imports: `import { connectDatabase, disconnectDatabase } from "#config/database";`,
            connect: `await connectDatabase();`,
            disconnect: `await disconnectDatabase();`,
            name: answers.database,
        });
    }

    if (answers.orm === "Drizzle" || answers.orm === "TypeORM") {
        services.push({
            imports: `import { connectDatabase, disconnectDatabase } from "#config/database";`,
            connect: `await connectDatabase();`,
            disconnect: `await disconnectDatabase();`,
            name: answers.database,
        });
    }

    if (answers.orm === "Sequelize") {
        services.push({
            imports: `import db from "#models/index";`,
            connect: `await db.sequelize.authenticate();`,
            disconnect: `await db.sequelize.close();`,
            name: answers.database,
        });
    }

    if (answers.redis) {
        services.push({
            imports: `import { connectRedis, disconnectRedis } from "#config/redis";`,
            connect: `await connectRedis();`,
            disconnect: `await disconnectRedis();`,
            name: "Redis",
        });
    }

    return services;
}

function getServerFile(answers) {
    const log = getLog(answers);
    const services = getServices(answers);

    const usesSocketIo = Boolean(answers.socketio);
    const imports = [
        ...(usesSocketIo ? [`import { createServer } from "node:http";`] : []),
        `import env from "#config/env";`,
        ...services.map((s) => s.imports),
    ];

    if (usesSocketIo) {
        imports.push(`import { attachSocketServer } from "#config/socket";`);
    }

    if (hasLoggerFile(answers)) {
        imports.push(`import { logger } from "#utils/logger";`);
    }

    const connect = services
        .map((s) => `    ${s.connect}\n    ${log}.info("Connected to ${s.name}");`)
        .join("\n");

    const disconnect = services.map((s) => `        ${s.disconnect}`).join("\n");

    const connectBlock = connect ? `${connect}\n\n` : "";
    const disconnectBlock = disconnect ? `\n${disconnect}` : "";

    const listen = usesSocketIo
        ? `server = createServer(app);
    io = attachSocketServer(server);
    server.listen`
        : "server = app.listen";
    const closeServer = usesSocketIo
        ? `    io.close(async () => {${disconnectBlock}
        process.exit(0);
    });`
        : `    server.close(async () => {${disconnectBlock}
        process.exit(0);
    });`;

    return `${imports.join("\n")}

let server;
${usesSocketIo ? "let io;" : ""}

async function start() {
${connectBlock}    const { default: app } = await import("#src/app");

    ${listen}(env.PORT, () => {
        ${log}.info(\`Server running on http://localhost:\${env.PORT}\`);
    });
}

// Stop accepting requests, close connections, then exit
async function shutdown(signal) {
    ${log}.info(\`\${signal} received, shutting down\`);

    // Signal arrived before the server started listening
    if (!server) {
        process.exit(0);
    }

${closeServer}
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((err) => {
    ${log}.error(${log === "logger" && answers.loggerType?.startsWith("Winston") ? "err.stack ?? String(err)" : "err"});
    process.exit(1);
});
`;
}

function getRoutesIndexFile(answers) {
    const swaggerHealth = answers.swagger
        ? `/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: The server is running
 */
`
        : "";

    return `import { Router } from "express";

const router = Router();

${swaggerHealth}router.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

export default router;
`;
}

const appErrorFile = `import { HTTP_STATUS } from "#constants/statusCodes.constants";
import { ERROR_CODES } from "#constants/errorCodes.constants";

export default class AppError extends Error {
    constructor(
        message,
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code = ERROR_CODES.INTERNAL_SERVER_ERROR
    ) {
        super(message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace?.(this, this.constructor);
    }
}`;

const apiErrorFile = ` import AppError from "#errors/AppError";
import { HTTP_STATUS } from "#constants/statusCodes.constants";
import { ERROR_CODES } from "#constants/errorCodes.constants";

// Throw this errors from services and middlewares; errorHandler turns it into a response
export class BadRequestError extends AppError {
    constructor(message = "Bad request") {
        super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
    }
}

export class UnprocessableEntityError extends AppError {
    constructor(message = "Unprocessable entity") {
        super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.UNPROCESSABLE_ENTITY);
    }
}

export class TooManyRequestsError extends AppError {
    constructor(message = "Too many requests") {
        super(message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.TOO_MANY_REQUESTS);
    }
}

export class InternalServerError extends AppError {
    constructor(message = "Internal server error") {
        super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
}`;

const notFoundFile = ` import { NotFoundError } from "#errors/HttpErrors";

export function notFound(req, res, next) {
    next(new NotFoundError(\`Route not found: \${req.method} \${req.originalUrl}\`));
}
`;

function getErrorMiddlewareFile(answers) {
    const log = getLog(answers);
    const multerImport = answers.multer ? `import multer from "multer";\n` : "";
    const multerErrorHandling = answers.multer
        ? `
    if (err instanceof multer.MulterError) {
        const statusCode =
            err.code === "LIMIT_FILE_SIZE"
                ? HTTP_STATUS.PAYLOAD_TOO_LARGE
                : HTTP_STATUS.BAD_REQUEST;

        return res.status(statusCode).json({
            success: false,
            code:
                statusCode === HTTP_STATUS.PAYLOAD_TOO_LARGE
                    ? ERROR_CODES.PAYLOAD_TOO_LARGE
                    : err.code,
            message:
                err.code === "LIMIT_FILE_SIZE"
                    ? "Uploaded file exceeds the maximum allowed size"
                    : err.message,
        });
    }
`
        : "";
    const logCall =
        log === "logger" && answers.loggerType?.startsWith("Winston")
            ? `logger.error(err.stack ?? String(err));`
            : `${log}.error(err);`;

    return `${loggerImport(answers, "middlewares")}${multerImport}
// Express recognizes error handlers by their 4 arguments, so keep \`next\`
import { HTTP_STATUS } from "#constants/statusCodes.constants";
import { ERROR_CODES } from "#constants/errorCodes.constants";
import env from "#config/env";

// Codes for errors that don't come from AppError, e.g. invalid JSON from express.json()
const ERROR_CODES_BY_STATUS = {
    [HTTP_STATUS.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
    [HTTP_STATUS.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
    [HTTP_STATUS.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
    [HTTP_STATUS.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
    [HTTP_STATUS.CONFLICT]: ERROR_CODES.CONFLICT,
    [HTTP_STATUS.PAYLOAD_TOO_LARGE]: ERROR_CODES.PAYLOAD_TOO_LARGE,
    [HTTP_STATUS.UNPROCESSABLE_ENTITY]: ERROR_CODES.UNPROCESSABLE_ENTITY,
    [HTTP_STATUS.TOO_MANY_REQUESTS]: ERROR_CODES.TOO_MANY_REQUESTS,
};

// Our own error codes are safe to send. Codes from libraries (ECONNREFUSED, 11000, ...) are not
function getErrorCode(err, statusCode) {
    if (err.isOperational) {
        return err.code;
    }

    if (statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        return ERROR_CODES_BY_STATUS[statusCode] ?? ERROR_CODES.BAD_REQUEST;
    }

    return ERROR_CODES.INTERNAL_SERVER_ERROR;
}

export function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

${multerErrorHandling}
    const statusCode = err.statusCode ?? err.status ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const isDev = env.NODE_ENV === "development";
    const isServerError = statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
    // Our own errors and 4xx errors from Express (invalid JSON, body too large) are safe to show
    const isSafeToExpose = err.isOperational || !isServerError;

    if (isServerError) {
        ${logCall}
    }

    res.status(statusCode).json({
        success: false,
        code: getErrorCode(err, statusCode),
        message: isDev || isSafeToExpose ? err.message : "Internal server error",
        ...(isSafeToExpose && err.details && { details: err.details }),
        ...(isDev && { stack: err.stack }),
    });
}
`.trimStart();
}

// Helpers for JWT auth: generated when "JWT auth" is picked
function getJwtFile(answers) {
    const refreshHelpers = answers.refreshTokens
        ? `
export function signRefreshToken(user) {
    return jwt.sign(
        { sub: String(user.id), tokenType: "refresh" },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );
}

export function verifyRefreshToken(token) {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (payload.tokenType !== "refresh") {
        throw new Error("Invalid refresh token");
    }

    return payload;
}
`
        : "";

    return `import jwt from "jsonwebtoken";
import env from "#config/env";

// The role goes into the token so authorize() can check it without a database lookup
export function signToken(user) {
    return jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
}

export function verifyToken(token) {
    return jwt.verify(token, env.JWT_SECRET);
}

// Use as the cookie's expiry so it expires together with the token
export function getTokenExpiry(token) {
    const { exp } = jwt.decode(token);
    return new Date(exp * 1000);
}
${refreshHelpers}
`;
}

const uploadMiddlewareFile = `import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import env from "#config/env";

const uploadDirectory = path.resolve(env.UPLOAD_DIR);

const storage = multer.diskStorage({
    destination(_req, _file, callback) {
        fs.mkdir(uploadDirectory, { recursive: true }, (err) => callback(err, uploadDirectory));
    },
    filename(_req, file, callback) {
        callback(null, \`\${crypto.randomUUID()}\${path.extname(file.originalname)}\`);
    },
});

export const upload = multer({
    storage,
    limits: {
        fileSize: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
        files: 5,
    },
});
`;

function getPasswordFile(answers) {
    if (answers.bcrypt) {
        return `import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}
`;
    }

    return `// Uses Node's built-in scrypt, so no extra package is needed.
// Stored format: "<salt>:<key>" (both hex)
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const key = await scrypt(password, salt, KEY_LENGTH);

    return \`\${salt}:\${key.toString("hex")}\`;
}

export async function comparePassword(password, hash) {
    const [salt, key] = hash.split(":");
    const derivedKey = await scrypt(password, salt, KEY_LENGTH);

    return crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}
`;
}

const authMiddlewareFile = `import { verifyToken } from "#utils/jwt";
import { UnauthorizedError } from "#errors/HttpErrors";

// Protect a route: router.get("/profile", requireAuth, controller.profile)
// Accepts the token from the "token" cookie or an "Authorization: Bearer" header,
// and sets req.user = { id, role } from the token
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = req.cookies?.token ?? (header?.startsWith("Bearer ") ? header.slice(7) : null);

    if (!token) {
        return next(new UnauthorizedError("Authentication required"));
    }

    try {
        const payload = verifyToken(token);
        req.user = { id: payload.sub, role: payload.role };
    } catch {
        return next(new UnauthorizedError("Invalid or expired token"));
    }

    next();
}
`;

const authorizeMiddlewareFile = `import { UnauthorizedError, ForbiddenError } from "#errors/HttpErrors";

// Use after requireAuth, which sets req.user:
// router.delete("/:id", requireAuth, authorize(ROLES.ADMIN), controller.remove)
export function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new UnauthorizedError("Authentication required"));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError("You don't have permission to do this"));
        }

        next();
    };
}
`;

const rolesFile = `export const ROLES = Object.freeze({
    USER: "user",
    ADMIN: "admin",
});
`;

function getSocketFile(answers) {
    const authMiddleware = answers.auth
        ? `
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            next(new Error("Authentication required"));
            return;
        }

        try {
            const payload = verifyToken(token);
            socket.data.user = { id: payload.sub, role: payload.role };
            next();
        } catch {
            next(new Error("Invalid or expired token"));
        }
    });
`
        : "";
    const authImport = answers.auth ? `import { verifyToken } from "#utils/jwt";\n` : "";

    return `import { Server } from "socket.io";
import env from "#config/env";
${authImport}
export function attachSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: env.CORS_ORIGIN,
            credentials: ${Boolean(answers.auth)},
        },
    });
${authMiddleware}
    io.on("connection", (socket) => {
        socket.emit("connection:ready", { socketId: socket.id });
    });

    return io;
}
`;
}

const authCodes = `  
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    INVALID_TOKEN: "INVALID_TOKEN",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    REFRESH_TOKEN_REQUIRED: "REFRESH_TOKEN_REQUIRED",
    REFRESH_TOKEN_INVALID: "REFRESH_TOKEN_INVALID" });`;

const errorCodesFile = `export const ERROR_CODES = Object.freeze({
    VALIDATION_ERROR: "VALIDATION_ERROR",
    BAD_REQUEST: "BAD_REQUEST",
    PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
    TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
    INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
`;

const statusCodesFile = `export const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,

    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    PAYLOAD_TOO_LARGE: 413,

    INTERNAL_SERVER_ERROR: 500,
});`;

const validateMiddlewareFile = `import { BadRequestError } from "#errors/HttpErrors";
import { ERROR_CODES } from "#constants/errorCodes.constants";

// Validates req.body with a Zod schema and replaces it with the parsed data:
// router.post("/products", validate(productSchema), controller.create)
export function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse({
            body: req.body,
            params: req.params,
            query: req.query,
        });

        if (!result.success) {
            const error = new BadRequestError("Validation failed");
            error.code = ERROR_CODES.VALIDATION_ERROR;
            error.details = result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            }));

            return next(error);
        }

        req.validated = result.data;
        next();
    };
}`;

function getTestFile(answers) {
    const rateLimitMock = answers.redis
        ? `import { vi } from "vitest";

vi.mock("#middlewares/rate-limit.middleware", () => ({
    rateLimiter: (_req, _res, next) => next(),
}));
`
        : "";

    return `import { describe, it, expect } from "vitest";
${rateLimitMock}
import request from "supertest";

import app from "#src/app";

describe("GET /api/health", () => {
    it("returns 200 and { status: 'ok' }", async () => {
        const res = await request(app).get("/api/health");

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/json/);
        expect(res.body).toEqual({ status: "ok" });
    });
});`;
}

function getAppFiles(answers, projectName) {
    const files = [
        { path: "src/app.js", content: getAppFile(answers) },
        { path: "src/server.js", content: getServerFile(answers) },
    ];

    if (hasLoggerFile(answers)) {
        files.push({ path: "src/utils/logger.js", content: getLoggerFile(answers) });
    }

    if (answers.email) {
        files.push({
            path: "src/services/email.service.js",
            content: getEmailServiceFile(),
        });
    }

    if (answers.auth) {
        files.push(
            { path: "src/utils/jwt.js", content: getJwtFile(answers) },
            { path: "src/constants/roles.constants.js", content: rolesFile }
        );
    }

    if (answers.socketio) {
        files.push({ path: "src/config/socket.js", content: getSocketFile(answers) });
    }

    files.push(...getRateLimitFiles(answers));

    if (answers.multer) {
        files.push({
            path: "src/middlewares/upload.middleware.js",
            content: uploadMiddlewareFile,
        });
    }

    if (answers.auth || answers.bcrypt) {
        files.push({ path: "src/utils/password.js", content: getPasswordFile(answers) });
    }

    // Express middlewares
    if (answers.auth) {
        files.push(
            { path: "src/middlewares/auth.middleware.js", content: authMiddlewareFile },
            { path: "src/middlewares/authorize.middleware.js", content: authorizeMiddlewareFile }
        );
    }

    if (answers.validation) {
        files.push({
            path: "src/middlewares/validate.middleware.js",
            content: validateMiddlewareFile,
        });
    }

    if (answers.test) {
        files.push({
            path: "tests/health.test.js",
            content: getTestFile(answers),
        });
    }

    files.push(
        { path: "src/routes/index.js", content: getRoutesIndexFile(answers) },
        { path: "src/middlewares/error.middleware.js", content: getErrorMiddlewareFile(answers) },
        { path: "src/middlewares/notFound.middleware.js", content: notFoundFile },
        { path: "src/errors/AppError.js", content: appErrorFile },
        { path: "src/errors/HttpErrors.js", content: apiErrorFile },
        {
            path: "src/constants/errorCodes.constants.js",
            content: errorCodesFile + (answers.auth ? authCodes : "});"),
        },
        { path: "src/constants/statusCodes.constants.js", content: statusCodesFile }
    );

    if (answers.swagger) {
        files.push({ path: "src/config/swagger.js", content: getSwaggerFile(projectName) });
    }

    return files;
}

module.exports = { getAppFiles, getLog, loggerImport };
