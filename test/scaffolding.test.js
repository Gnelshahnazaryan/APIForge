const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const { getAppFiles } = require("../lib/app-files");
const { getConnectionFiles } = require("../lib/connections");
const { getConfig: getDrizzleConfig } = require("../lib/drizzle");
const { getEnvFiles } = require("../lib/env");
const { getDependencies } = require("../lib/installer");
const { getReadme } = require("../lib/readme");
const { getDatabaseConfig, sequelizerc } = require("../lib/sequelize");
const { getSchema: getPrismaSchema } = require("../lib/prisma");

const databases = ["PostgreSQL", "MySQL", "SQLite"];
const orms = ["Prisma", "Drizzle", "TypeORM", "Sequelize"];

function getAnswers(database, orm, extra = {}) {
    return {
        database,
        orm,
        dotenv: true,
        cors: true,
        helmet: true,
        multer: true,
        ...extra,
    };
}

function assertValidModule(source) {
    const result = spawnSync(
        process.execPath,
        ["--input-type=module", "--check"],
        { input: source, encoding: "utf8" }
    );

    assert.equal(result.status, 0, result.stderr);
}

function assertValidCommonJs(source) {
    const result = spawnSync(process.execPath, ["--check"], {
        input: source,
        encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
}

test("generates valid database connection and application modules for every SQL ORM", () => {
    for (const database of databases) {
        for (const orm of orms) {
            const answers = getAnswers(database, orm);
            const envFiles = getEnvFiles(answers, "sample-api");
            const files = [
                ...getConnectionFiles(answers),
                ...getAppFiles(answers, "sample-api"),
                { path: "src/config/env.js", content: envFiles.module },
                { path: "src/constants/env.constants.js", content: envFiles.constants },
            ];

            for (const file of files) {
                if (file.path.endsWith(".js")) {
                    assertValidModule(file.content);
                }
            }
        }
    }

    const typeormSqlite = getConnectionFiles(getAnswers("SQLite", "TypeORM")).find(
        (file) => file.path === "src/config/database.js"
    );
    assert.match(typeormSqlite.content, /type: "better-sqlite3"/);
    assert.doesNotMatch(typeormSqlite.content, /type: "sqlite"/);
});

test("generates Socket.IO server wiring, config, environment, and dependency", () => {
    for (const answers of [
        getAnswers("None", undefined, { socketio: true, cors: false }),
        getAnswers("None", undefined, {
            socketio: true,
            auth: true,
            cors: false,
        }),
    ]) {
        const files = getAppFiles(answers, "sample-api");
        const socketFile = files.find(({ path }) => path === "src/config/socket.js");
        const serverFile = files.find(({ path }) => path === "src/server.js");
        const env = getEnvFiles(answers, "sample-api");

        assert.ok(socketFile);
        assert.match(socketFile.content, /new Server\(httpServer/);
        assert.match(serverFile.content, /createServer\(app\)/);
        assert.match(serverFile.content, /attachSocketServer\(server\)/);
        assert.match(serverFile.content, /io\.close/);
        assert.match(env.example, /^CORS_ORIGIN=http:\/\/localhost:5173$/m);
        assertValidModule(socketFile.content);
        assertValidModule(serverFile.content);

        if (answers.auth) {
            assert.match(socketFile.content, /socket\.handshake\.auth\?\.token/);
            assert.match(socketFile.content, /verifyToken\(token\)/);
        } else {
            assert.doesNotMatch(socketFile.content, /Authentication required/);
        }
    }

    const { dependencies } = getDependencies(
        getAnswers("None", undefined, { socketio: true, cors: false })
    );
    assert.ok(dependencies.includes("socket.io"));
});

test("stores the listening server so shutdown can close it", () => {
    const expressServer = getAppFiles(
        getAnswers("None", undefined, { socketio: false }),
        "sample-api"
    ).find(({ path }) => path === "src/server.js").content;
    const socketServer = getAppFiles(
        getAnswers("None", undefined, { socketio: true }),
        "sample-api"
    ).find(({ path }) => path === "src/server.js").content;

    assert.match(expressServer, /server = app\.listen/);
    assert.match(socketServer, /server = createServer\(app\)/);
    assert.match(expressServer, /server\.close/);
    assertValidModule(expressServer);
    assert.match(socketServer, /io\.close/);
    assertValidModule(socketServer);
});

test("loads the Express app after Redis connects when Redis is selected", () => {
    const server = getAppFiles(
        getAnswers("None", undefined, { redis: true }),
        "sample-api"
    ).find(({ path }) => path === "src/server.js").content;

    assert.doesNotMatch(server, /import app from "#src\/app"/);
    assert.ok(server.indexOf("await connectRedis()") < server.indexOf('await import("#src/app")'));
    assert.ok(server.indexOf('await import("#src/app")') < server.indexOf("server = app.listen"));
    assertValidModule(server);
});

test("generates valid migration configuration for Prisma, Drizzle, and Sequelize", () => {
    const providers = {
        PostgreSQL: "postgresql",
        MySQL: "mysql",
        SQLite: "sqlite",
    };

    for (const database of databases) {
        const answers = getAnswers(database, "Prisma");
        assert.match(getPrismaSchema(answers), new RegExp(`provider = "${providers[database]}"`));
        assertValidModule(getDrizzleConfig(getAnswers(database, "Drizzle")));
        assertValidCommonJs(getDatabaseConfig(getAnswers(database, "Sequelize")));
    }

    assertValidModule(sequelizerc);
    assert.match(sequelizerc, /export\s*\{/);
    assert.match(sequelizerc, /modelsPath as "models-path"/);
});

test("loads the Sequelize CLI config as ESM in generated projects", () => {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sequelize-config-"));

    try {
        fs.writeFileSync(
            path.join(directory, "package.json"),
            JSON.stringify({ type: "module" })
        );
        fs.writeFileSync(path.join(directory, ".sequelizerc"), sequelizerc);
        const result = spawnSync(
            process.execPath,
            [
                "-e",
                'console.log(JSON.stringify(require("./.sequelizerc")));',
            ],
            { cwd: directory, encoding: "utf8" }
        );

        assert.equal(result.status, 0, result.stderr);
        const config = JSON.parse(result.stdout);
        const realDirectory = fs.realpathSync(directory);
        assert.equal(config.config, path.join(realDirectory, "src/config/database.cjs"));
        assert.equal(config["models-path"], path.join(realDirectory, "src/models"));
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("selects the database driver and ORM dependencies for every SQL combination", () => {
    const expectedDrivers = {
        PostgreSQL: {
            Prisma: ["@prisma/adapter-pg@7", "pg"],
            Drizzle: ["drizzle-orm", "drizzle-kit", "pg"],
            TypeORM: ["typeorm", "reflect-metadata", "pg"],
            Sequelize: ["sequelize", "sequelize-cli", "pg", "pg-hstore"],
        },
        MySQL: {
            Prisma: ["@prisma/adapter-mariadb@7", "mariadb"],
            Drizzle: ["drizzle-orm", "drizzle-kit", "mysql2"],
            TypeORM: ["typeorm", "reflect-metadata", "mysql2"],
            Sequelize: ["sequelize", "sequelize-cli", "mysql2"],
        },
        SQLite: {
            Prisma: ["@prisma/adapter-better-sqlite3@7", "better-sqlite3"],
            Drizzle: ["drizzle-orm", "drizzle-kit", "better-sqlite3"],
            TypeORM: ["typeorm", "reflect-metadata", "better-sqlite3"],
            Sequelize: ["sequelize", "sequelize-cli", "sqlite3"],
        },
    };

    for (const database of databases) {
        for (const orm of orms) {
            const { dependencies, devDependencies } = getDependencies(getAnswers(database, orm));
            const allPackages = [...dependencies, ...devDependencies];

            for (const dependency of expectedDrivers[database][orm]) {
                assert.ok(
                    allPackages.includes(dependency),
                    `${database} + ${orm} should install ${dependency}`
                );
            }
        }
    }
});

test("generates database URLs and upload configuration", () => {
    const mysql = getEnvFiles(getAnswers("MySQL", "TypeORM"), "sample-api");
    const sqlite = getEnvFiles(getAnswers("SQLite", "Drizzle"), "sample-api");
    const uploads = getAppFiles(getAnswers("SQLite", "Drizzle"), "sample-api");

    assert.match(mysql.example, /^DATABASE_URL=mysql:\/\//m);
    assert.match(sqlite.example, /^DATABASE_URL=file:\.\/dev\.db$/m);
    assert.match(sqlite.example, /^UPLOAD_DIR=uploads$/m);
    assert.match(sqlite.example, /^UPLOAD_MAX_FILE_SIZE_MB=5$/m);
    assert.match(
        uploads.find((file) => file.path === "src/middlewares/upload.middleware.js").content,
        /multer\.diskStorage/
    );
    assert.match(
        uploads.find((file) => file.path === "src/middlewares/error.middleware.js").content,
        /PAYLOAD_TOO_LARGE/
    );
});

test("TypeORM migration scripts generate runnable ESM JavaScript migrations", () => {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const { updatePackageJson } = require("../lib/package-json");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "typeorm-scripts-"));

    try {
        fs.writeFileSync(
            path.join(directory, "package.json"),
            JSON.stringify({ scripts: {} })
        );
        updatePackageJson(directory, getAnswers("SQLite", "TypeORM"));

        const { scripts } = JSON.parse(
            fs.readFileSync(path.join(directory, "package.json"), "utf8")
        );
        assert.match(scripts["db:migration:generate"], /--esm/);
        assert.match(scripts["db:migrate"], /migration:run/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("documents the selected database and file-upload behavior", () => {
    const answers = getAnswers("SQLite", "Drizzle", { auth: true });
    const readme = getReadme(answers, "sample-api", ["config", "database", "middlewares"]);

    assert.match(readme, /SQLite \+ Drizzle/);
    assert.match(readme, /npm run db:generate/);
    assert.match(readme, /upload\.single\("file"\)/);
    assert.match(readme, /HTTP 413/);
    assert.match(readme, /Review the generated `\.env` file/);
    assert.match(readme, /randomly generated JWT secret/);
    assert.doesNotMatch(readme, /cp \.env\.example \.env/);
});

test("documents only generated project folders, including Drizzle database files", () => {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const { createStructure } = require("../lib/structure");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "api-forge-structure-"));

    try {
        createStructure(directory, {
            database: "SQLite",
            orm: "Drizzle",
            test: false,
        });

        const readme = fs.readFileSync(path.join(directory, "README.md"), "utf8");
        assert.match(readme, /└── src\/\n/);
        assert.doesNotMatch(readme, /├── tests\/\n/);
        assert.match(readme, /├── database\/\n/);
        assert.ok(fs.existsSync(path.join(directory, "src", "database")));

        createStructure(directory, { database: "None", test: true });
        const readmeWithTests = fs.readFileSync(path.join(directory, "README.md"), "utf8");
        assert.match(readmeWithTests, /├── tests\/\n└── src\/\n/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("documents Socket.IO setup and whether JWT auth is enabled", () => {
    const unauthenticated = getReadme(
        getAnswers("None", undefined, { socketio: true, cors: false }),
        "sample-api",
        ["config"]
    );
    const authenticated = getReadme(
        getAnswers("None", undefined, { socketio: true, auth: true, cors: false }),
        "sample-api",
        ["config"]
    );

    assert.match(unauthenticated, /CORS_ORIGIN/);
    assert.match(unauthenticated, /not authenticated by default/);
    assert.match(authenticated, /requires a JWT/);
});

test("generates a constant for every HTTP error code used by the error classes", () => {
    const files = getAppFiles(getAnswers("None", undefined), "sample-api");
    const errorFiles = files.filter(({ path }) => path.startsWith("src/errors/"));
    const errorCodes = files.find(
        ({ path }) => path === "src/constants/errorCodes.constants.js"
    ).content;
    const referencedCodes = new Set(
        errorFiles.flatMap(({ content }) =>
            [...content.matchAll(/ERROR_CODES\.([A-Z_]+)/g)].map(([, code]) => code)
        )
    );

    for (const code of referencedCodes) {
        assert.match(errorCodes, new RegExp(`\\b${code}: "${code}"`));
    }
});

test("shows CLI help without starting the project prompts", () => {
    const result = spawnSync(process.execPath, ["bin/api-forge.js", "--help"], { encoding: "utf8" });
    const output = result.stdout.replace(/\u001B\[[0-9;]*m/g, "");

    assert.equal(result.status, 0, result.stderr);
    assert.match(output, /Usage:\s+apiforge \[project-name\] \[options\]/);
    assert.match(output, /-h, --help\s+Show this help message/);
    assert.match(output, /-v, --version\s+Show the version number/);
    assert.match(output, /apiforge my-api/);
    assert.match(output, /Database\s+MongoDB, PostgreSQL, MySQL, SQLite or none/);
    // The intro is only shown when a project is really being created
    assert.doesNotMatch(output, /Let's build your backend/);
});

test("prints the version with --version and -v", () => {
    const { version } = require("../package.json");

    for (const flag of ["--version", "-v"]) {
        const result = spawnSync(process.execPath, ["bin/api-forge.js", flag], { encoding: "utf8" });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), version);
    }
});

test("rejects unknown options and points to --help", () => {
    const result = spawnSync(process.execPath, ["bin/api-forge.js", "--nope"], { encoding: "utf8" });

    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /Unknown option "--nope"/);
    assert.match(result.stdout + result.stderr, /apiforge --help/);
});