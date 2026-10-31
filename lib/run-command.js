const { spawn, spawnSync } = require("node:child_process");

const activeChildren = new Set();

// Runs a shell command without blocking, so spinners keep animating.
// Output is captured and attached to the error if the command fails.
function runCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        // detached gives the command its own process group on macOS/Linux,
        // so it can be killed together with everything it started.
        // (exec() ignores this option, which is why this uses spawn())
        const child = spawn(command, {
            cwd,
            shell: true,
            detached: process.platform !== "win32",
            stdio: ["ignore", "pipe", "pipe"],
        });

        activeChildren.add(child);

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });

        child.on("error", (err) => {
            activeChildren.delete(child);
            err.output = `${stdout}${stderr}`.trim();
            reject(err);
        });

        child.on("close", (code) => {
            activeChildren.delete(child);

            if (code === 0) {
                resolve(stdout);
                return;
            }

            const err = new Error(`Command failed: ${command}`);
            err.output = `${stdout}${stderr}`.trim();
            reject(err);
        });
    });
}

// Kills every running command and everything it started (npm, node-gyp, ...).
// Synchronous, so it is safe to call from a process "exit" handler
function killActiveCommands() {
    for (const child of activeChildren) {
        try {
            if (process.platform === "win32") {
                spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
            } else {
                process.kill(-child.pid, "SIGKILL");
            }
        } catch {
            // already exited
        }
    }

    activeChildren.clear();
}

module.exports = { runCommand, killActiveCommands };