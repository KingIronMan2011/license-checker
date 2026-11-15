# License Checker

Scan a Node.js project’s installed dependencies, report their licenses, and optionally copy license files into an output directory.

## Requirements

- Node.js 24 or newer
- Dependencies installed in the project being scanned

## Install

Run without installing:

```sh
pnpm dlx @kingironman2011/license-checker
```

Or add it to a project:

```sh
pnpm add -D @kingironman2011/license-checker
pnpm exec license-checker
```

The current directory is scanned by default. Use `--start <path>` to choose a different project directory.

## CLI options

Run `license-checker --help` for the complete usage text.

| Option                                 | Description                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `--start <path>`                       | Project directory to scan. Defaults to the current directory.                                           |
| `--production`                         | Include production dependencies only.                                                                   |
| `--development`                        | Include development dependencies only.                                                                  |
| `--direct [value]`                     | Set traversal depth. `false` limits to direct dependencies; a number sets the depth.                    |
| `--depth <number>`                     | Set traversal depth; takes precedence over `--direct`.                                                  |
| `--nopeer`                             | Skip peer dependencies.                                                                                 |
| `--includePackages <list>`             | Include only matching packages; separate package names or `name@version` entries with semicolons.       |
| `--excludePackages <list>`             | Exclude matching packages; separate entries with semicolons.                                            |
| `--excludePackagesStartingWith <list>` | Exclude package names with these prefixes; separate prefixes with semicolons.                           |
| `--excludePrivatePackages`             | Exclude private packages.                                                                               |
| `--includeLicenses <list>`             | Include only these license names; separate names with commas.                                           |
| `--excludeLicenses <list>`             | Exclude these license names; separate names with commas.                                                |
| `--onlyAllow <list>`                   | Exit with an error if a license is outside this semicolon-separated allowlist.                          |
| `--failOn <list>`                      | Exit with an error if a license matches this semicolon-separated list.                                  |
| `--unknown`                            | Report guessed license titles as unknown.                                                               |
| `--onlyunknown`                        | Show only unknown or guessed licenses.                                                                  |
| `--clarificationsFile <path>`          | Load package license clarifications from a JSON file.                                                   |
| `--clarificationsMatchAll`             | Require every clarification entry to match a package.                                                   |
| `--json`                               | Print JSON output.                                                                                      |
| `--csv`                                | Print CSV output.                                                                                       |
| `--markdown`                           | Print Markdown output.                                                                                  |
| `--summary`                            | Print a license usage summary.                                                                          |
| `--plainVertical`                      | Print Angular CLI-compatible plain vertical output.                                                     |
| `--angularCli`                         | Alias for `--plainVertical`.                                                                            |
| `--limitAttributes <list>`             | Restrict formatted output to comma-separated fields.                                                    |
| `--out <path>`                         | Write the report to a file instead of the terminal.                                                     |
| `--files <path>`                       | Copy discovered license files into this directory.                                                      |
| `--relativeLicensePath`                | Print license file paths relative to the report or current directory.                                   |
| `--relativeModulePath`                 | Print module paths relative to the scanned project.                                                     |
| `--customPath <path>`                  | Load custom output fields from a JSON file.                                                             |
| `--csvComponentPrefix <prefix>`        | Prefix component names in CSV output.                                                                   |
| `--color` / `--no-color`               | Enable or disable color in terminal tree output.                                                        |
| `--silent`                             | Hide the terminal license tree/report. Scanning, `--out` file writing, and `--files` copying still run. |
| `--help`, `-h`                         | Show CLI usage.                                                                                         |
| `--version`, `-v`                      | Print the package version.                                                                              |

Examples:

```sh
# Scan production dependencies and print the default tree report
pnpm exec license-checker --production

# Scan a different project and write JSON to a file
pnpm exec license-checker --start ./path/to/project --json --out licenses.json

# Hide the terminal license tree while copying license files
pnpm exec license-checker --files ./licenses --silent
```

## Library API

The package exports `runLicenseCheck` for JavaScript and TypeScript:

```ts
import { runLicenseCheck } from "@kingironman2011/license-checker";

const dependencies = await runLicenseCheck({
  start: process.cwd(),
  production: true,
});

console.log(dependencies);
```

## Development

```sh
pnpm install
pnpm build
pnpm lint
pnpm format:check
```
