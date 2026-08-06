# CEM-S Blockbench Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Blockbench plugin MVP that exports native Blockbench cubes into deterministic CEM-S 1.21.6 GLSL.

**Architecture:** Keep a pure, dependency-free exporter core separate from the Blockbench adapter. The adapter reads Blockbench's native `Cube.all` data and exposes an Export CEM-S command; the core validates a small intermediate model and emits model GLSL plus a manifest.

**Tech Stack:** JavaScript (CommonJS for tests, browser-compatible UMD for plugin), Node's built-in test runner.

## Global Constraints

- Target CEM-S version: 1.21.6.
- First MVP supports cubes and groups; no custom mesh or animation export.
- Blockbench's native outliner/properties remain the editing UI.
- Export output is deterministic and contains no external runtime dependencies.

### Task 1: Exporter core

**Files:** Create `src/cem-exporter.js`; create `test/cem-exporter.test.js`.

- [x] Add tests for cube emission, rotated cube emission, deterministic output, and invalid input.
- [x] Implement `validateModel`, `formatVec3`, `emitPart`, and `exportModel` as a UMD module.
- [x] Run `node --test test/cem-exporter.test.js` and verify all tests pass.

### Task 2: Blockbench plugin adapter

**Files:** Create `plugin.js`; create `manifest.json`; create `README.md`.

- [x] Register the plugin with Blockbench's Plugin API.
- [x] Add an `Export CEM-S 1.21.6` menu item that serializes `Cube.all` and opens a save dialog.
- [x] Reject unsupported transformed parent groups with an actionable diagnostic.
- [x] Document installation and supported modeling subset.

### Task 3: Packaging verification

**Files:** Create `package.json`.

- [x] Add a Node test script and package metadata.
- [x] Run the full test command and a syntax check for `plugin.js`.
