# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [3.0.0]

### Added
- Major refactor of the app
- Fixed critical issue where sponsored products were not being displayed correctly
- Added `transformCategoriesToPath` setting to use categories as path instead of IDs

## [2.3.1]

### Added
- Skip auctions for seachQuery and categories

## [2.3.0]

### Added
- Support for encoded characters
- Improve auction rate on keywords

## [2.2.6]

### Added
- Fix several issues

## [2.2.5]

### Added
- Fix several issues

## [2.2.4]

### Added
- Decode strings with invalid characters

## [2.2.3]

### Added
- Fix several issues

## [2.2.2]

### Added
- Added missing properties to expanded result.

## [2.2.1]

### Added
- Find missing winners using API

## [2.2.0]

### Added
- Added `alwaysLeafCategoryAuction` settings parameter to run auctions only over leaf categories
- Added `activateDebugSponsoredTags` settings parameter to display the (Ad) tag next to sponsored products
- Improved fill-rate for keyword auctions
- Fixed minor bugs

## [2.1.1] - 2025-03-11

### Added

- Fix several issues

## [2.1.0] - 2025-03-11

### Added

- Added support for Keyword and Categories listings

## [2.0.3] - 2025-02-27

### Fix

- Change label from Sponsored to Ad

## [2.0.2] - 2025-02-27

### Fix

- Fix security vulnerability

## [2.0.1] - 2025-02-19

### Changed
- Removed limitation for product list length

## [2.0.0] - 2024-12-16

### Added
- Centralizing use of Topsort Services IO to retrieve settings

## [1.0.2] - 2024-11-08

### Fixed
- Modified Topsort's app name to get settings from VTEX

## [1.0.1] - 2024-10-28

### Added
- User agent as part of Topsort API call

## [1.0.0] - 2024-10-28

### Added
- Introduced Topsort's Auction engine middleware
