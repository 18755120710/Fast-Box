# Fast Box 产品需求与开发文档

## 1. 项目概述

Fast Box 是一个免费、开源、面向国内用户优先的跨平台桌面端开发环境管理器。

它的目标是帮助编程新手和开发者快速准备本地开发环境，避免用户手动搜索安装包、配置环境变量、排查安装失败等问题。

Fast Box 的主入口是桌面端应用，不是 CLI。CLI 可以作为高级用户和自动化场景的可选能力存在。

## 2. 产品定位

Fast Box 不是单纯的软件下载器，也不是完全意义上的 Docker 替代品。

它的定位是：

```text
桌面端开发环境管理器 + 多版本切换工具 + 环境模板安装器
```

第一版采用“隔离安装 + 全局命令代理”的方案：

- 开发工具安装到 Fast Box 管理目录。
- 通过 shims 暴露全局命令。
- 桌面端 UI 负责安装、卸载、切换、验证和展示状态。
- Registry 负责提供环境安装配方。
- MySQL 等服务类环境优先使用容器或独立实例管理。

## 3. 目标用户

### 编程新手

他们需要：

- 一键安装开发环境。
- 不手动配置环境变量。
- 安装失败时看到明确原因。
- 通过模板安装组合环境。

### 开发者

他们需要：

- 换电脑后快速恢复开发环境。
- 多版本安装和切换。
- 清晰管理每个工具的版本、来源、路径和状态。
- 支持国内镜像源，提高下载成功率。

## 4. 第一版目标

第一版目标是做出可运行、可验证、可扩展的 MVP。

第一版必须支持：

- macOS Apple Silicon
- macOS Intel
- Windows x64
- Node.js 多版本安装和切换
- Fast Box 管理目录
- shims 全局命令代理
- 安装日志
- 安装后验证
- 卸载已安装版本

第一版优先打通 Node.js，因为 Node.js 更适合验证下载、解压、校验、shim、PATH、版本切换和卸载这条核心链路。

## 5. 第一版暂不做

第一版不要做这些功能：

- 用户账号系统
- 在线评分和评论
- 团队空间
- 复杂插件市场
- Linux 支持
- 所有环境一次性接入
- 完整 Docker 替代能力
- 自动执行未经校验的远程脚本

## 6. 技术选型

### 桌面端

- Tauri
- TypeScript
- Rust

### 前端

建议使用：

- React
- TypeScript
- Tailwind CSS

ui 组件库可使用：
- shadcn

### Rust Core

Rust 负责所有本地系统能力：

- 系统检测
- CPU 架构检测
- 下载文件
- SHA256 校验
- 解压安装包
- 生成 shims
- 管理 PATH
- 管理当前激活版本
- 写入配置文件
- 安装日志
- 卸载版本
- 调用外部命令

前端不要直接处理复杂系统逻辑。

## 7. 工作目录设计

macOS:

```text
~/.fastbox/
  packages/
  shims/
  state/
  cache/
  logs/
  registry/
  config.json
```

Windows:

```text
%USERPROFILE%\.fastbox\
  packages\
  shims\
  state\
  cache\
  logs\
  registry\
  config.json
```

### packages

存放真实环境文件。

示例：

```text
~/.fastbox/packages/node/24.16.0/
~/.fastbox/packages/node/22.17.0/
```

每个版本必须独立安装，不能互相覆盖。

### shims

存放命令代理。

示例：

```text
~/.fastbox/shims/node
~/.fastbox/shims/npm
~/.fastbox/shims/npx
```

系统 PATH 只应该加入 shims 目录，不应该直接加入具体版本目录。

### state

存放当前激活版本。

示例：

```json
{
  "active": {
    "node": "24.16.0"
  }
}
```

### cache

存放下载缓存。

### logs

存放安装、卸载、验证日志。

### registry

缓存远程 Registry 配方。

## 8. 多版本切换需求

Fast Box 必须支持类似 nvm 的多版本切换，但主操作入口是桌面端 UI。

桌面端流程：

```text
打开 Fast Box
进入 Node.js 详情页
安装 24.16.0
安装 22.17.0
选择 24.16.0
点击设为当前版本
终端执行 node --version
选择 22.17.0
点击设为当前版本
终端执行 node --version
```

CLI 只是可选等价能力：

```bash
fastbox install node@24.16.0
fastbox use node@22.17.0
```

### 切换规则

- 同一个环境可以安装多个版本。
- 每个版本安装到独立目录。
- 只能有一个全局激活版本。
- 桌面端“设为当前版本”只修改 state。
- shim 根据 state 转发到真实二进制。
- 卸载非激活版本时直接删除版本目录。
- 卸载激活版本时必须提示用户先切换，或自动切换到默认版本。

## 9. shims 工作方式

用户执行：

```bash
node --version
```

实际流程：

```text
终端找到 ~/.fastbox/shims/node
shim 读取 ~/.fastbox/state/active.json
发现 node 当前激活版本是 24.16.0
shim 转发到 ~/.fastbox/packages/node/24.16.0/bin/node
```

Windows 下 shim 可以使用 `.cmd`、`.ps1` 或小型可执行文件。

后续如果条件允许，建议统一生成小型 Rust shim 可执行文件，跨平台行为更稳定。

## 10. Registry 设计

Registry 是环境安装配方仓库，不负责执行安装逻辑。

推荐结构：

```text
fast-box-registry/
  packages/
    node.json
    java.json
    python.json
    git.json
    rust.json
    mysql.json
  templates/
    frontend.json
    java-backend.json
    python-basic.json
    rust-dev.json
    fullstack-basic.json
  schemas/
    package.schema.json
```

### package 配方必须包含

- 环境名称
- 展示名称
- 安装模式
- 默认版本
- 版本列表
- 平台下载地址
- 国内备用源
- SHA256
- 解压方式
- 二进制命令列表
- 验证命令
- 卸载策略

## 11. Node.js MVP

第一版只需要完整打通 Node.js。

Node.js 支持平台：

- macOS arm64
- macOS x64
- Windows x64

安装包策略：

- macOS 使用 `.tar.xz`
- Windows 使用 `.zip`
- 不使用 `.pkg` 或 `.msi`
- 不要求管理员权限

必须实现：

- 查看可安装版本
- 安装指定版本
- 查看已安装版本
- 设置当前版本
- 卸载指定版本
- 下载进度展示
- 安装日志展示
- SHA256 校验
- `node --version` 验证
- `npm --version` 验证
- npm 国内源配置

## 12. 页面设计

### 首页

展示：

- 当前系统
- CPU 架构
- Fast Box 工作目录
- 已安装环境数量
- 安装中的任务
- 最近失败记录

### 环境列表页

展示：

- Node.js
- Java
- Git
- Python
- MySQL
- Rust

每个环境展示：

- 是否已安装
- 当前激活版本
- 可安装版本数
- 状态

### 环境详情页

以 Node.js 为例，展示：

- 环境名称
- 简介
- 当前激活版本
- 已安装版本列表
- 可安装版本列表
- 安装按钮
- 设为当前版本按钮
- 卸载按钮
- 验证按钮
- 日志入口

### 安装任务页

展示：

- 当前任务名称
- 当前步骤
- 下载进度
- 校验状态
- 解压状态
- shim 生成状态
- 验证结果
- 错误信息

### 设置页

展示：

- Fast Box 工作目录
- 镜像源偏好
- PATH 状态
- 日志目录
- Registry 地址
- 是否启用 CLI

## 13. 状态模型

### PackageStatus

```ts
type PackageStatus = {
  name: string
  displayName: string
  installedVersions: string[]
  activeVersion?: string
  availableVersions: string[]
  status: 'not_installed' | 'installed' | 'installing' | 'failed'
}
```

### InstallTask

```ts
type InstallTask = {
  id: string
  packageName: string
  version: string
  platform: string
  status: 'pending' | 'downloading' | 'verifying' | 'extracting' | 'activating' | 'success' | 'failed'
  progress: number
  message: string
  logPath?: string
}
```

### ActiveState

```ts
type ActiveState = {
  active: Record<string, string>
}
```

## 14. 安全规则

Fast Box 必须遵守：

- 不执行未经校验的远程脚本。
- 所有下载文件必须校验 SHA256。
- 所有安装动作必须有日志。
- 安装位置必须对用户可见。
- 不默认修改系统关键目录。
- PATH 只加入 Fast Box 的 shims 目录。
- 卸载只能删除 Fast Box 管理目录内的文件。
- 遇到权限需求必须明确提示用户。

## 15. 错误处理

错误提示必须让用户知道：

- 哪一步失败。
- 失败原因是什么。
- 是否可以重试。
- 日志在哪里。
- 是否需要用户手动处理。

示例：

```text
Node.js 24.16.0 安装失败
失败步骤：SHA256 校验
原因：下载文件校验值不匹配
建议：请切换下载源后重试
日志：~/.fastbox/logs/install-node-24.16.0.log
```

## 16. 开发优先级

### P0

- Tauri 项目初始化
- 基础 UI 布局
- 系统和架构检测
- Fast Box 工作目录初始化
- Registry 读取
- Node.js 版本列表
- Node.js 下载
- SHA256 校验
- 解压安装
- shims 生成
- PATH 检测和引导
- 当前版本切换
- 安装后验证
- 卸载指定版本

### P1

- 安装任务进度
- 日志面板
- npm 国内源配置
- CLI 可选入口
- Java 接入
- Python 接入
- Rust 接入

### P2

- Git 接入
- MySQL 容器管理
- 环境模板
- 项目级版本切换
- 导入导出环境清单

## 17. 验收标准

Node.js MVP 验收标准：

- macOS arm64 可以安装 Node.js 24.16.0。
- macOS x64 可以安装 Node.js 24.16.0。
- Windows x64 可以安装 Node.js 24.16.0。
- 同一台机器可以安装两个 Node.js 版本。
- 桌面端可以切换当前版本。
- 终端执行 `node --version` 能反映桌面端选择的版本。
- 卸载非当前版本不会影响当前版本。
- 卸载当前版本时有明确提示。
- 下载失败、校验失败、解压失败都有日志。

## 18. 开发原则

- 桌面端优先，CLI 可选。
- 先做 Node.js，一条链路跑通后再扩展。
- 不把环境直接装进系统目录。
- 不把具体版本目录写入 PATH。
- 不为了快而绕过 SHA256 校验。
- 不一次性接入所有环境。
- 所有系统操作放在 Rust Core。
- 前端只负责展示、交互和调用命令。
- 用户必须始终知道 Fast Box 做了什么。

