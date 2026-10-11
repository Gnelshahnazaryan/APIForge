const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js
.yarn/
jspm_packages/

# Environment variables
.env
.env.*
!.env.example

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Build output
dist/
build/
out/
*.tsbuildinfo

# Testing / coverage
coverage/
.nyc_output/
*.lcov

# Caches
.cache/
.eslintcache
.stylelintcache
.npm/
.node_repl_history
*.tgz

# Uploads
uploads/

# Local databases
*.sqlite
*.sqlite3
*.db
dump.rdb

# Editors / IDEs
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
Thumbs.db
ehthumbs.db
Desktop.ini
`;

module.exports = gitignore;
