<!-- markdownlint-disable MD024 -->

# Changelog

License Checker release notes.

This project follows [Semantic Versioning](http://semver.org) guidelines.

## Unreleased

## v1.0.0

### Added

- TypeScript-based ESM package and `license-checker` CLI.
- Recursive license checks for production and development dependencies, including transitive dependencies.
- Terminal license reports with `--silent`, `--production`/`--prod`, and `--development`/`--dev` options.
- License file extraction with `--extract`/`--files`, organized by dependency scope, package, and version.
- Programmatic `runLicenseCheck` API.
- `--check` to report dependencies missing both license metadata and a license file, with a nonzero exit status for CI.
