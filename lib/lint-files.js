// ESLint (flat config) + Prettier. Prettier owns formatting;
// eslint-config-prettier turns off ESLint rules that would fight it.

function getEslintConfig(answers) {
    // sequelize-cli generates CommonJS into these folders (see sequelize.js)
    const commonjsBlock =
        answers.orm === "Sequelize"
            ? `
    {
        files: ["src/models/**/*.js", "src/database/**/*.js"],
        languageOptions: { sourceType: "commonjs" },
    },`
            : "";

    return `import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
    {
        ignores: ["node_modules/", "coverage/", "generated/"],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: globals.node,
        },
        rules: {
            // Allow unused args that start with _, e.g. (_req, res) => ...
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },${commonjsBlock}
    prettier,
];
`;
}

const prettierConfig = `{
    "tabWidth": 4,
    "printWidth": 100,
    "singleQuote": false,
    "semi": true,
    "trailingComma": "es5"
}
`;

const prettierIgnore = `node_modules/
coverage/
generated/
package-lock.json
`;

function getLintFiles(answers) {
    if (!answers.lint) {
        return [];
    }

    return [
        { path: "eslint.config.js", content: getEslintConfig(answers) },
        { path: ".prettierrc", content: prettierConfig },
        { path: ".prettierignore", content: prettierIgnore },
    ];
}

module.exports = { getLintFiles };
