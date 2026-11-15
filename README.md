# License Checker

Scan a Node.js project’s production and development dependencies, print their license information, and copy discovered license files into an output directory.

## Requirements

- Node.js 24 or newer
- A project with dependencies installed

## Install

Run the CLI directly with pnpm:

```sh
pnpm dlx @kingironman2011/license-checker
```

Or install it in a project:

```sh
pnpm add -D @kingironman2011/license-checker
```

Then run:

```sh
pnpm exec license-checker
```

The command scans the current directory by default. Pass a project directory to scan another project:

```sh
pnpm exec license-checker ./path/to/project
```

## CLI options

```text
Usage: license-checker [project-directory] [options]

Options:
  --check               List dependencies with no license metadata or license file
  --silent, -s          Do not print the license report
  --extract, --files <dir> Copy license files into <dir>
  --production, --prod  Scan production dependencies only
  --development, --dev  Scan development dependencies only
  --all                 Scan both dependency scopes (default)
  --help, -h            Show this help
```

Examples:

```sh
# Check production dependencies in the current directory
pnpm exec license-checker --production

# Find dependencies without license metadata or a license file (exits nonzero if any are found)
pnpm exec license-checker --check

# Copy discovered license files to ./licenses
pnpm exec license-checker --extract ./licenses
```

When `--check` finds dependencies whose license is unknown and which have no license files, it lists them and exits with status 1. Otherwise it reports that all dependencies have license metadata or license files. `--silent` suppresses report output; it does not change the exit status.

## Library API

The package also exports `runLicenseCheck` for use from JavaScript or TypeScript:

```ts
import { runLicenseCheck } from "@kingironman2011/license-checker";

const dependencies = await runLicenseCheck({
  start: process.cwd(),
  production: true,
});

console.log(dependencies);
```

Options include `start` (project directory), `production`, `development`, and `files` (directory for extracted license files). With neither scope selected, both production and development dependencies are scanned. Each result includes the package name, version, license, license file paths, and dependency scope.

## Development

```sh
pnpm install
pnpm build
pnpm lint
pnpm format:check
```
