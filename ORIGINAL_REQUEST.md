# Original User Request

## Initial Request — 2026-06-07T12:39:15Z

本项目的目标是构建 Fast Box —— 一个免费、开源、面向国内用户优先的跨平台桌面端开发环境管理器。第一版 (MVP) 重点在于打通 Node.js 的多版本下载、解压、SHA256 校验、shims 代理、PATH 引导、版本切换与卸载的核心链路。

Working directory: `/Users/butvan/Butvan_Projets/vibe coding project/Fast Box`
Integrity mode: development

## Requirements

### R1. Tauri + Rust 后端核心逻辑
- **系统与架构检测**：检测当前操作系统（macOS arm64/x64、Windows x64）和 CPU 架构。
- **环境下载与校验**：读取 `fast-box-registry` 配方，使用国内镜像（如华为云等）下载 Node.js 安装包，下载时提供进度回调，并对下载的文件进行 SHA256 完整性校验。
- **解压与安装**：将安装包解压到 `~/.fastbox/packages/node/{version}`。
- **shims 全局命令代理**：在 `~/.fastbox/shims/` 目录下生成 `node`、`npm`、`npx` 等代理脚本/程序。
- **版本切换与状态管理**：更新 `~/.fastbox/state/active.json` 以记录当前激活版本，让 shims 能够根据此状态动态转发命令。
- **卸载功能**：支持安全删除指定版本的安装目录并刷新 shims，卸载当前激活版本时需做安全提示。

### R2. 简约干净大厂风格前端 UI (React + Tailwind CSS)
- **首页**：展示系统信息、CPU 架构、工作目录、最近任务与错误。
- **环境列表与详情页**：展示 Node.js 及其可安装/已安装版本。支持一键安装、设为当前版本、卸载、验证和查看日志。
- **安装进度与日志面板**：实时展示当前安装步骤（下载、校验、解压、shim 生成、验证）的进度及详细日志。
- **设置页**：可配置工作目录、镜像源偏好、Registry 地址，并提供 PATH 引导提示。

## Acceptance Criteria

### Node.js 环境管理闭环
- [ ] 能够成功读取本地/远程 `fast-box-registry` 配置并展示 Node.js 24.16.0 的安装选项。
- [ ] 在 macOS（arm64/x64）和 Windows x64 下，可以通过界面一键下载并成功解压 Node.js 指定版本。
- [ ] 下载文件必须经过 SHA256 校验，若校验失败有明确报错并记录日志。
- [ ] 成功生成对应的 shims 文件，当通过桌面端切换激活版本时，通过 shims 执行 `node --version` 能正确输出对应版本。
- [ ] 支持安全卸载已安装的 Node.js 版本。
- [ ] 整个下载、安装、校验、卸载过程有明确的进度展示与日志可供查阅。
- [ ] UI 需符合极简大厂设计风格（Space Mono 字体、#0F172A 背景、#22C55E 强调色，提供流畅的过渡动画与 hover 态）。

## Follow-up — 2026-06-08T00:49:10Z

由于服务器重启，先前的子任务与心跳服务已中断。请执行以下步骤以恢复工作：
1. 检查并读取工作区当前的 PROJECT.md 和 .agents/orchestrator/ 中的 plan.md、progress.md、context.md 等。
2. 评估当前的代码编写与修复情况（比如清理未使用的 Terminal 导入、安装 @types/node 等的进度）。
3. 重新设置你的进度报告 Cron 和存活检查 Cron 等监控机制。
4. 恢复你的编排任务，根据当前进度继续推进 Milestone 1 (M1) 及 E2E 测试轨的开发。如有需要，请重新启动下属子代理。
5. 向我汇报你目前评估的最新状态。
