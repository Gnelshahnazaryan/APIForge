const path = require("node:path");
const fs = require("node:fs");
const p = require("@clack/prompts");
const pc = require("picocolors");

const { version } = require("../package.json");
const { askQuestions, askProjectName } = require("./prompts");
const { createStructure } = require("./structure");
const { installPackages } = require("./installer");

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
    console.log();
    p.intro(`${pc.bgCyan(pc.black(" create-backend-app "))} ${pc.dim(`v${version}`)}`);

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
        fs.mkdirSync(projectPath, { recursive: true });
        createStructure(projectPath, answers);
    } catch (err) {
        fail(`Failed to create project folder: ${err.message}`);
    }

    p.log.success("Created folder structure");

    await installPackages(projectPath, answers);

    p.note(
        `${pc.cyan(`cd ${projectName}`)}\n${pc.cyan("npm run dev")}`,
        "Next steps"
    );

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    p.outro(`${pc.green("Done")} in ${seconds}s`);
}

module.exports = { run, fail };
