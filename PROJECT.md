# Project: Fast Box

## Architecture
Fast Box MVP is a cross-platform desktop application built using Tauri, React, and Tailwind CSS.
It manages local development toolchains (focusing on Node.js for MVP) in an isolated directory (`~/.fastbox`), proxies commands through a shim directory, and manages the active tool versions through a simple JSON state file.

```
       +---------------------------------------------+
       |                  React UI                   |
       |  (Home, EnvList, EnvDetail, Tasks, Settings)|
       +----------------------+----------------------+
                              |
                     Tauri IPC (Commands & Events)
                              |
                              v
       +----------------------+----------------------+
       |                 Rust Core                   |
       |  - Downloader (with progress events)        |
       |  - Extractor (tar.xz, zip)                  |
       |  - State Manager (active.json)              |
       |  - Shim Generator (executables/scripts)      |
       |  - Verification Engine                      |
       +---------------------------------------------+
```

## Milestones

| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 1 | M1: Project Setup & UI | Setup Tauri React workspace, UI layout, system info, registry read | None | IN_PROGRESS | cc353806-c7a3-440e-bfd2-9d0230d53a08 |
| 2 | M2: Download & Install | Implement package download with progress, SHA256 check, extract to ~/.fastbox | M1 | PLANNED | TBD |
| 3 | M3: Shim & Switcher | Rust shim binary/scripts, active.json updates, version switcher command, verify installation | M2 | PLANNED | TBD |
| 4 | M4: Uninstall & Config | Safe version deletion, active version warning, post-install configurations | M3 | PLANNED | TBD |
| 5 | M5: E2E Integration | Full integration with E2E test suite, pass 100% tests | M4, E2E | PLANNED | TBD |
| 6 | M6: Adversarial Hardening | Tier 5 white-box coverage hardening | M5 | PLANNED | TBD |

## E2E Testing Track
The E2E Testing Track runs in parallel to design and implement an independent test runner/suite verifying requirements (Tiers 1-4).
- Status: IN_PROGRESS
- Conversation ID: 010bff1b-6049-4a57-aa4c-f569a1b0b93a

## Interface Contracts

### Tauri IPC Commands (Rust -> TS)

1. **`get_system_info`**
   - Signature: `fn get_system_info() -> Result<SystemInfo, String>`
   - Return type: `{ os: string, arch: string, fastbox_home: string }`

2. **`list_packages`**
   - Signature: `fn list_packages() -> Result<Vec<PackageStatus>, String>`
   - Return type: `Array<{ name: string, displayName: string, installedVersions: string[], activeVersion?: string, status: string }>`

3. **`install_package_version`**
   - Signature: `fn install_package_version(name: string, version: string) -> Result<String, String>`
   - Async command: returns task ID, emits progress events to frontend.

4. **`use_package_version`**
   - Signature: `fn use_package_version(name: string, version: string) -> Result<(), String>`

5. **`uninstall_package_version`**
   - Signature: `fn uninstall_package_version(name: string, version: string) -> Result<(), String>`

6. **`verify_package_version`**
   - Signature: `fn verify_package_version(name: string, version: string) -> Result<Vec<VerifyResult>, String>`

7. **`get_task_logs`**
   - Signature: `fn get_task_logs(task_id: string) -> Result<Vec<String>, String>`

### Events (Rust -> TS)
- **`install-progress`**: `{ task_id: string, stage: string, progress: number, message: string }`
- **`install-log`**: `{ task_id: string, message: string }`

## Code Layout
```
/Users/butvan/Butvan_Projets/vibe coding project/Fast Box/
├── .agent/                  # Skills
├── .agents/                 # Agent metadata
├── fast-box-registry/       # Git submodule/directory with package recipes
├── docx/                    # Documentation
├── src-tauri/               # Tauri Rust Core
│   ├── src/
│   │   ├── main.rs          # App entry and command registration
│   │   ├── commands.rs      # Tauri frontend command handlers
│   │   ├── system.rs        # Platform/arch detection & path setup
│   │   ├── registry.rs      # Registry JSON reader
│   │   ├── download.rs      # HTTP download with progress callbacks
│   │   ├── extract.rs       # tar.xz and zip extractor
│   │   ├── state.rs         # active.json read/write manager
│   │   ├── shims.rs         # Shim file generation
│   │   ├── verify.rs        # Commands execution verifier
│   │   └── utils.rs         # Helper functions
│   ├── Cargo.toml           # Rust dependencies (tauri, reqwest, sha2, tar, zip, etc.)
│   └── tauri.conf.json      # Tauri settings
├── src/                     # React Frontend
│   ├── components/          # Shared components (Layout, ProgressBar, LogPanel)
│   ├── pages/               # Views (Home, EnvList, EnvDetail, Settings)
│   ├── App.tsx              # Main routing and navigation
│   ├── main.tsx             # Entry mount point
│   └── index.css            # Tailwind & styling rules
├── package.json             # Frontend and Dev dependencies (pnpm)
├── tsconfig.json            # TS compiler config
├── tailwind.config.js       # Tailwind CSS config
├── vite.config.ts           # Vite Bundler configuration
└── ORIGINAL_REQUEST.md      # Immutable requirement file
```
