# APIForge

**Build your backend faster.**

APIForge is an interactive CLI tool that helps developers quickly scaffold customizable Node.js and Express.js backend projects.

Choose your preferred database, ORM, authentication method, validation library, and development tools. APIForge generates a structured backend project with the selected dependencies and configurations.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Available Options](#available-options)
- [Generated Project Structure](#generated-project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Features

- Interactive project generation
- Modular backend architecture
- Express.js setup
- Multiple database and ORM options
- JWT authentication
- Cookie-based authentication
- Request validation with Zod
- Redis integration
- File uploads with Multer
- Real-time communication with Socket.IO
- Centralized error handling
- Security middleware
- Logging
- Swagger API documentation
- Development tools and testing setup

## Requirements

Before using APIForge, make sure you have:

- [Node.js](https://nodejs.org/) (version 20.19+ or 22.12+)
- npm

## Installation

Install APIForge globally using npm:

```bash
npm install -g api-forge
```

Verify the installation:

```bash
apiforge --help
```

## Usage

### Create a new project

Run the following command:

```bash
apiforge my-api
```

APIForge will start an interactive setup process.

Select the technologies and features you want to include in your backend project.

After configuration, APIForge generates the project structure and installs the selected dependencies.

### Navigate to your project

```bash
cd my-api
```

### Start the development server

```bash
npm run dev
```

Available scripts depend on the selected project configuration.

## Available Options

APIForge allows you to customize your backend project through interactive prompts.

### Framework

| Technology | Description           |
| ---------- | --------------------- |
| Express.js | Backend web framework |

### Databases

Choose your preferred database:

| Database   | Description                                |
| ---------- | ------------------------------------------ |
| MongoDB    | NoSQL document database                    |
| PostgreSQL | Relational database                        |
| MySQL      | Relational database                        |
| SQLite     | Lightweight file-based relational database |

### ORMs / ODMs

Choose from the supported database tools:

| ORM / ODM | Description                              |
| --------- | ---------------------------------------- |
| Mongoose  | MongoDB ODM                              |
| Prisma    | Type-safe ORM                            |
| Sequelize | Promise-based ORM                        |
| Drizzle   | TypeScript-first ORM                     |
| TypeORM   | ORM supporting TypeScript and JavaScript |

Available ORM choices depend on the selected database and implemented integrations.

### Authentication

- JWT authentication
- Cookie-based authentication
- Password hashing with bcrypt

### Validation

- Zod request validation

### Caching

- Redis integration

### File Uploads

- Multer integration
- Single file uploads
- Multiple file uploads
- File size and type restrictions

### Real-time Communication

- Socket.IO integration
- Socket connection authentication with JWT
- Real-time event handling

### Security

- Helmet
- CORS
- Cookie handling

### Logging

- Winston
- Morgan
- Pino

### API Documentation

- Swagger / OpenAPI

### Development Tools

- Nodemon
- ESLint
- Prettier
- Vitest
- Supertest

## Generated Project Structure

APIForge generates a modular backend architecture.

Example:

```text
my-api/
├── tests/
├── src/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── errors/
│   ├── middlewares/
│   ├── models/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   │
│   ├── app.js
│   └── server.js
│
├── uploads/
├── .env
├── .gitignore
├── package.json
└── README.md
```

The generated structure depends on the selected technologies and features. Optional directories are only included when needed.

### Directory Responsibilities

| Directory       | Responsibility                         |
| --------------- | -------------------------------------- |
| `config/`       | Application and database configuration |
| `constants/`    | Application constants                  |
| `errors/`       | Application errors                     |
| `controllers/`  | HTTP request and response handling     |
| `middlewares/`  | Express middleware                     |
| `models/`       | Database models                        |
| `repositories/` | Database operations                    |
| `routes/`       | API route definitions                  |
| `services/`     | Business logic                         |
| `utils/`        | Reusable helper functions              |
| `validators/`   | Request validation schemas             |

## Getting Started

After generating your project, follow these steps.

### 1. Configure environment variables

Open the `.env` file and configure the required variables.

Example:

```env
PORT=3000
NODE_ENV=development
```

Database, authentication, and other environment variables depend on your selected options.

### 2. Configure your database

Make sure your database server is running if your selected database requires one.

Configure the connection URL in your `.env` file.

### 3. Start the development server

```bash
npm run dev
```

Your backend API should now be running.

## Configuration

APIForge generates a project based on your selected options.

You can modify the generated source code, install additional dependencies, or customize the architecture according to your needs.

APIForge does not restrict you to a specific application structure after generation.

## Contributing

Contributions are welcome!

If you find a bug, have a feature request, or want to improve APIForge, feel free to open an issue or submit a pull request.

### How to contribute

1. Fork the repository.
2. Clone your fork.
3. Create a new branch.
4. Make your changes.
5. Commit your changes.
6. Push your branch.
7. Open a pull request.

### Repository

[APIForge on GitHub](https://github.com/Gnelshahnazaryan/APIForge)

## License

APIForge is licensed under the [MIT License](./LICENSE).

You are free to use, copy, modify, distribute, and use this software for commercial purposes, subject to the MIT License terms.

See the [LICENSE](./LICENSE) file for the complete license text.

---

**APIForge — Build your backend faster.**
