<!-- markdownlint-disable MD024 -->

# Changelog

License Checker release notes.

This project follows [Semantic Versioning](http://semver.org) guidelines.

## Unreleased

## v1.1.0

### Added

- Native SPDX license expression parsing, validation, and license identifier data.

### Changed

- Major rewrite of license checking, package resolution, CLI parsing, and report rendering with native TypeScript implementations.
- Replaced the SPDX, terminal color, semantic version, cloning, debugging, CLI parsing, tree rendering, package metadata, and dependency resolution packages with project-owned code.
- Improved type safety across license collection, policy checks, output formatting, and package traversal.

## v1.0.0

### Added

- TypeScript-based ESM package and `license-checker` CLI.
- Recursive license checks for production and development dependencies, including transitive dependencies.
- Terminal license reports with `--silent`, `--production`/`--prod`, and `--development`/`--dev` options.
- License file extraction with `--extract`/`--files`, organized by dependency scope, package, and version.
- Programmatic `runLicenseCheck` API.
- `--check` to report dependencies missing both license metadata and a license file, with a nonzero exit status for CI.
