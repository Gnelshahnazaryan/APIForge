#!/usr/bin/env node

const { run, fail } = require("../lib/cli");

run().catch((err) => fail(err.message));
