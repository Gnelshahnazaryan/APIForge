const fs = require("node:fs");
const path = require("node:path");
const gitignore = require("./gitignore");
const { getEnvFiles } = require("./env");
const { getReadme } = require("./readme");
const { getConnectionFiles } = require("./connections");

const folders = [
    "config",
    "constants",
    "controllers",
    "middlewares",
    "routes",
    "services",
    "utils",
];

function getFolders(answers) {
    const projectFolders = [...folders];

    if (answers.database !== "None") {
        projectFolders.push("repositories");
    }

    if (answers.database === "MongoDB") {
        projectFolders.push("models");
    }

    if (answers.validation) {
        projectFolders.push("validators");
    }

    return projectFolders.sort();
}

function getFiles(answers, projectName, srcFolders) {
    const { env, example, module } = getEnvFiles(answers, projectName);

    return [
        { path: ".env", content: env },
        { path: ".env.example", content: example },
        { path: ".gitignore", content: gitignore },
        { path: "README.md", content: getReadme(answers, projectName, srcFolders) },
        { path: "src/config/env.js", content: module },
        ...getConnectionFiles(answers),
        { path: "src/app.js", content: "" },
        { path: "src/server.js", content: "" },
    ];
}

function createStructure(projectPath, answers) {
    const projectName = path.basename(projectPath);
    const srcFolders = getFolders(answers);
    const allFolders = [...srcFolders.map((folder) => path.join("src", folder)), "tests"];

    for (const folder of allFolders) {
        fs.mkdirSync(path.join(projectPath, folder), { recursive: true });
    }

    for (const file of getFiles(answers, projectName, srcFolders)) {
        fs.writeFileSync(path.join(projectPath, file.path), file.content);
    }

    // .gitkeep keeps empty folders in git; delete it once the folder has files
    for (const folder of allFolders) {
        const folderPath = path.join(projectPath, folder);

        if (fs.readdirSync(folderPath).length === 0) {
            fs.writeFileSync(path.join(folderPath, ".gitkeep"), "");
        }
    }
}

module.exports = { createStructure };
