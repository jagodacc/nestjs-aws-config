# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-08-06

### Fixed

- Fixed AWS AppConfig polling to handle empty `Configuration` responses as "no change" after initial load, instead of throwing an error.

## [0.2.0] - 2026-08-06

### Added

- Added dedicated `AwsConfigError` for module runtime failures.
- Added `fallbackPollIntervalInSeconds` module option to control fallback/retry polling interval (default: `60`, clamped to `1..3600`).

### Changed

- Updated package dependencies to current versions, including AWS SDK and RxJS.
- Updated NestJS compatibility to `@nestjs/common >=11`.
- Improved JSON content-type handling to accept valid values like `application/json; charset=utf-8`.

## [0.1.1] - 2025-04-18

### Fixed

- Fixed `package.json` dependencies.

## [0.1.0] - 2025-04-18

### Added

- Initial release of the package.
