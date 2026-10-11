const { exec } = require("node:child_process");

// Runs a shell command without blocking, so spinners keep animating.
// Output is captured and attached to the error if the command fails.
function runCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                err.output = `${stdout}${stderr}`.trim();
                reject(err);
                return;
            }

            resolve(stdout);
        });
    });
}

module.exports = { runCommand };
