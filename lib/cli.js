const path = require("node:path");
const fs = require("node:fs");
const p = require("@clack/prompts");
const pc = require("picocolors");

const { version } = require("../package.json");
const { askQuestions, askProjectName } = require("./prompts");
const { createStructure } = require("./structure");
const { installPackages } = require("./installer");
const { killActiveCommands } = require("./run-command");
const { showBanner } = require("./banner");
const { getHelpText } = require("./help");

// Set once we create the project folder; cleared when the project is fully created
let createdPath = null;

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Runs on every exit (success, error, Ctrl+C, kill), so it must be synchronous.
// Stops npm first, otherwise it keeps writing files while we delete the folder
function cleanupProject() {
    if (!createdPath) {
        return;
    }

    killActiveCommands();

    // A killed process can need a moment to release its files, so retry for ~3s
    for (let attempt = 0; attempt < 15; attempt++) {
        try {
            fs.rmSync(createdPath, { recursive: true, force: true });
        } catch {
            // Try again below
        }

        if (!fs.existsSync(createdPath)) {
            break;
        }

        sleep(200);
    }

    if (fs.existsSync(createdPath)) {
        console.error(`Could not delete "${createdPath}". Please remove it manually.`);
    }

    createdPath = null;
}

process.on("exit", cleanupProject);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));
process.on("SIGHUP", () => process.exit(129));

function fail(message) {
    p.cancel(pc.red(message));
    process.exit(1);
}

function validateProjectName(name) {
    if (!name) {
        return "Please enter a project name";
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
        return `Invalid name "${name}". Use only letters, numbers, '-', '_' and '.', starting with a letter or number`;
    }

    if (fs.existsSync(path.join(process.cwd(), name))) {
        return `Folder "${name}" already exists`;
    }
}

async function run(argv = process.argv.slice(2)) {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(getHelpText(version));
        return;
    }

    if (argv.includes("--version") || argv.includes("-v")) {
        console.log(version);
        return;
    }

    // Project names can't start with "-", so anything that does is an unknown option
    const unknownOption = argv.find((arg) => arg.startsWith("-"));

    if (unknownOption) {
        fail(`Unknown option "${unknownOption}". Run "apiforge --help" to see the available options.`);
    }

    showBanner();
    p.intro(`${pc.bgGreen(pc.black(" Let's build your backend "))} ${pc.dim(`v${version}`)}`);

    let projectName = argv[0];

    if (projectName) {
        const error = validateProjectName(projectName);

        if (error) {
            fail(error);
        }

        p.log.step(`Project name\n${pc.dim(projectName)}`);
    } else {
        projectName = await askProjectName(validateProjectName);
    }

    const projectPath = path.join(process.cwd(), projectName);
    const answers = await askQuestions();
    const startedAt = Date.now();

    try {
        // Not recursive: if the folder appeared since validation, this throws
        // instead of letting cleanup delete a folder we didn't create
        fs.mkdirSync(projectPath);
        createdPath = projectPath;
        createStructure(projectPath, answers);
    } catch (err) {
        fail(`Failed to create project folder: ${err.message}`);
    }

    p.log.success("Created folder structure");

    await installPackages(projectPath, answers);

    createdPath = null;

    p.note(`${pc.green(`cd ${projectName}`)}\n${pc.green("npm run dev")}`, "Next steps");

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    p.outro(`${pc.green("Done")} in ${seconds}s`);
}

module.exports = { run, fail };