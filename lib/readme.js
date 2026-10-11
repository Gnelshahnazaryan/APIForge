function getStack(answers) {
    const stack = [];

    if (answers.express) stack.push("Express");
    if (answers.database === "MongoDB") stack.push("MongoDB + Mongoose");
    if (answers.database === "PostgreSQL") stack.push(`PostgreSQL + ${answers.postgresOrm}`);
    if (answers.redis) stack.push("Redis");
    if (answers.auth) stack.push("JWT auth (jsonwebtoken + cookie-parser)");
    if (answers.bcrypt) stack.push("bcrypt");
    if (answers.validation) stack.push("Zod");
    if (answers.cors) stack.push("cors");
    if (answers.helmet) stack.push("helmet");
    if (answers.useLogger) stack.push(answers.loggerType.replace(" and ", " + "));
    if (answers.swagger) stack.push("Swagger");
    if (answers.dotenv) stack.push("dotenv");
    if (answers.nodemon) stack.push("nodemon");

    return stack;
}

function getDatabaseSteps(answers) {
    if (answers.database === "PostgreSQL" && answers.postgresOrm === "Prisma") {
        return "\n4. Define your models in `prisma/schema.prisma`, then create the tables and regenerate the client:\n\n```bash\nnpx prisma migrate dev\nnpx prisma generate\n```\n";
    }

    if (answers.database === "PostgreSQL" && answers.postgresOrm === "Sequelize") {
        return "\n4. Create the database and run migrations:\n\n```bash\nnpx sequelize-cli db:create\nnpx sequelize-cli db:migrate\n```\n\nThe project uses ES modules, but `src/models/` and `src/database/` stay CommonJS (each has a `package.json` with `\"type\": \"commonjs\"`), because sequelize-cli only generates CommonJS files. Import models from app code with `import db from \"./models/index.js\"`.\n";
    }

    return "";
}

function getReadme(answers, projectName, folders) {
    const stack = getStack(answers);
    const stackSection = stack.length > 0
        ? `## Stack\n\n${stack.map((item) => `- ${item}`).join("\n")}\n\n`
        : "";

    const folderList = folders
        .map((folder, i) => `    ${i === folders.length - 1 ? "└──" : "├──"} ${folder}/`)
        .join("\n");

    return `# ${projectName}

${stackSection}## Getting started

1. Install dependencies:

\`\`\`bash
npm install
\`\`\`

2. Create your \`.env\` from the example and fill in the values:

\`\`\`bash
cp .env.example .env
\`\`\`

3. Start the dev server:

\`\`\`bash
npm run dev
\`\`\`
${getDatabaseSteps(answers)}
## Project structure

\`\`\`
${projectName}/
├── tests/
└── src/
    ├── app.js        # builds the Express app
    ├── server.js     # starts the server
${folderList}
\`\`\`
`;
}

module.exports = { getReadme };
