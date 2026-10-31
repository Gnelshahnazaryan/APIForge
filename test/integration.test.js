const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
    createGeneratedProject,
    findFreePort,
    startGeneratedServer,
    stopGeneratedServer,
    waitForHealth,
} = require("./helpers/generated-project");

test("generates, installs, and starts an Express project", { timeout: 600_000 }, async (t) => {
    const project = await createGeneratedProject({ database: "None", cors: false });
    t.after(() => project.cleanup());

    const port = await findFreePort();
    const server = startGeneratedServer(project.directory, port);
    t.after(() => stopGeneratedServer(server));

    assert.deepEqual(await waitForHealth(server, port), { status: "ok" });
});
