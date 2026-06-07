# 项目名称：Fast Box

> 快速盒子：一个面向编程新手和开发者的跨平台开发环境管理工具。
>
> 它希望像 Docker Hub 一样，让用户可以一键拉取、安装、启用和卸载开发环境，例如 Java、Git、Node.js、Python、MySQL、Rust 等。

## 项目定位

Fast Box 是一个免费、开源、面向国内用户优先的桌面端开发环境管理器。

它的目标不是简单地把安装包下载到本机，而是帮助用户完成完整的开发环境准备流程：

- 自动检测当前系统和 CPU 架构。
- 自动选择合适版本和国内镜像源。
- 一键安装常用开发环境。
- 自动配置环境变量或命令入口。
- 安装后自动验证是否可用。
- 清晰展示每个环境的状态、版本、来源和安装位置。
- 支持卸载、禁用和重新安装。

## 项目启发

项目灵感来自 Docker Hub：

- 用户不需要手动找安装包。
- 用户不需要理解复杂的环境配置。
- 用户可以选择一个环境模板，然后一键拉取到本地。
- 环境应该容易管理和卸载。

但 Fast Box 的第一版不建议完全照搬 Docker 的容器模式，因为 Java、Git、Node.js、Python、Rust 这类命令行工具通常需要在用户的终端、IDE 和项目目录里全局可用。

因此第一版建议采用“隔离安装 + 全局命令代理”的混合方案。

## 核心矛盾

你希望环境既像 Docker 一样隔离、好卸载、方便管理，又希望它能全局生效。

这两件事天然有冲突：

- 完全容器化：好卸载、好隔离，但不容易让 `java`、`git`、`node`、`python`、`cargo` 这些命令在所有终端和 IDE 中自然可用。
- 完全本机安装：全局生效简单，但卸载、回滚和多版本管理困难。

第一版推荐方案：

- Java、Git、Node.js、Python、Rust：安装到 Fast Box 自己管理的隔离目录。
- MySQL：优先使用容器或独立服务实例管理。
- 全局生效：通过 PATH 注入、命令代理、Shell 配置或 Windows 环境变量实现。
- 卸载：删除 Fast Box 管理目录，并清理 PATH 或代理命令。

## 目标用户

### 编程新手

他们的痛点是：

- 不知道应该安装哪些环境。
- 不知道去哪下载安装包。
- 不知道怎么配置环境变量。
- 安装失败后不知道怎么排查。

Fast Box 对他们的价值：

- 提供“前端开发环境”“Java 后端开发环境”“Python 学习环境”等模板。
- 用图形界面展示安装步骤。
- 用明确的状态提示替代复杂命令行。

### 开发者

他们的痛点是：

- 换电脑后要重复配置环境。
- 多语言、多版本工具链管理麻烦。
- 希望快速恢复一套熟悉的开发环境。

Fast Box 对他们的价值：

- 一键安装常用工具链。
- 支持版本切换。
- 支持导出和导入环境清单。
- 支持国内镜像源，提高下载稳定性。

## 第一版范围

第一版建议同时支持 macOS 和 Windows，但功能要控制范围。

### 支持系统

- macOS Apple Silicon
- macOS Intel
- Windows x64

暂时不把 Linux 放进第一版，避免系统差异过大。

### 第一批环境

- Java
- Git
- Node.js
- Python
- MySQL
- Rust

### 第一批环境模板

- 前端开发环境：Git、Node.js
- Java 后端开发环境：Git、Java、MySQL
- Python 学习环境：Git、Python
- Rust 开发环境：Git、Rust
- 全栈基础环境：Git、Node.js、Java、Python、MySQL

## 技术选型

### 桌面端

- Tauri
- TypeScript
- Rust

Tauri 适合这个项目，因为它体积小、可以调用 Rust 做本地系统操作，也适合跨平台桌面应用。

### 前端 UI

建议使用：

- React 或 Vue
- TypeScript
- Tailwind CSS 或 UnoCSS

第一版界面模块：

- 首页环境概览
- 环境模板列表
- 单个环境详情
- 安装任务进度
- 日志面板
- 设置页

### Rust 核心能力

Rust 负责：

- 系统检测
- 下载文件
- 校验文件
- 解压安装包
- 执行安装命令
- 管理环境变量
- 写入 Shell 配置
- Windows PATH 管理
- 安装状态记录
- 多版本安装和切换
- 命令代理 shims
- 当前激活版本状态管理
- 卸载和清理

### 后端

第一版不需要传统后端。

推荐先使用一个远程 Registry 仓库，存放环境清单和安装配方。

例如：

```text
fast-box-registry/
  packages/
    java.json
    git.json
    node.json
    python.json
    mysql.json
    rust.json
  templates/
    frontend.json
    java-backend.json
    python-basic.json
```

以后如果需要账号、团队模板、收藏、评分、在线市场，再做后端服务。

## 安装架构

### 推荐目录

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

存放真实环境。每个环境可以安装多个版本，每个版本必须放在独立目录。

例如：

```text
~/.fastbox/packages/node/22.17.0/
~/.fastbox/packages/node/24.16.0/
~/.fastbox/packages/java/21/
~/.fastbox/packages/python/3.12.2/
```

### shims

存放全局命令代理。

例如：

```text
~/.fastbox/shims/node
~/.fastbox/shims/npm
~/.fastbox/shims/java
~/.fastbox/shims/python
~/.fastbox/shims/git
~/.fastbox/shims/cargo
```

只需要把 `~/.fastbox/shims` 加入 PATH，就可以让命令全局生效。

PATH 不应该直接指向某个具体版本目录，例如不应该直接加入 `~/.fastbox/packages/node/24.16.0/bin`。

### state

存放当前激活版本状态。

例如：

```json
{
  "active": {
    "node": "24.16.0",
    "java": "21",
    "python": "3.12.2",
    "rust": "1.87.0"
  }
}
```

## 多版本切换架构

Fast Box 必须支持类似 nvm 的多版本切换能力。

Fast Box 是桌面端项目，所以主入口应该是图形界面：

```text
用户打开 Fast Box
进入 Node.js 详情页
点击安装 24.16.0
点击安装 22.17.0
在版本列表里选择 24.16.0
点击设为当前版本
终端执行 node --version
在版本列表里选择 22.17.0
点击设为当前版本
终端执行 node --version
```

用户在桌面端选择哪个版本，当前全局环境就生效哪个版本。

命令行可以作为可选能力存在，用于高级用户和自动化场景：

```bash
fastbox install node@24.16.0
fastbox use node@22.17.0
```

### 核心规则

- 同一个环境允许安装多个版本。
- 每个版本安装到独立目录。
- PATH 只加入 Fast Box 的 `shims` 目录。
- 桌面端切换版本时，只修改当前激活版本状态。
- 可选 CLI 的 `use` 命令和桌面端切换按钮做同一件事。
- `node`、`npm`、`python`、`java`、`cargo` 等命令都由 shim 转发。
- 卸载某个版本时，只删除对应版本目录。
- 如果卸载的是当前激活版本，需要提示用户切换到其他版本，或自动回退到默认版本。

### shims 工作方式

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

Windows 下同理，只是 shim 可以是 `.cmd`、`.ps1` 或 Fast Box 生成的小型可执行文件。

### 全局切换和项目切换

第一版建议先做桌面端全局切换：

```text
Node.js 详情页 -> 已安装版本 -> 设为当前版本
```

可选 CLI 等价命令：

```bash
fastbox use node@24.16.0
```

后续可以扩展桌面端项目级切换：

```text
项目环境页 -> 选择项目目录 -> 指定 Node.js 版本
```

可选 CLI 等价命令：

```bash
fastbox use node@24.16.0 --local
```

项目级切换可以在项目目录写入：

```text
.fastboxrc
```

当用户在某个项目目录执行命令时，shim 优先读取项目配置；如果没有项目配置，再读取全局激活版本。

### cache

存放下载缓存，避免重复下载。

### logs

存放安装日志，方便用户和开发者排查问题。

### registry

缓存远程环境清单。

## 环境准备方式

### Java

建议第一版使用 Eclipse Temurin JDK。

准备内容：

- macOS arm64 安装包地址
- macOS x64 安装包地址
- Windows x64 安装包地址
- SHA256 校验值
- 解压或安装方式
- `JAVA_HOME` 配置方式
- `java -version` 验证命令

国内用户可考虑提供国内镜像源，但需要注意镜像源是否长期稳定。

### Git

Git 在不同系统上差异较大。

macOS 方案：

- 优先检测系统是否已有 Git。
- 如果没有，提示安装 Xcode Command Line Tools，或使用独立 Git 安装包。

Windows 方案：

- 使用 Git for Windows 安装包。
- 支持静默安装。
- 安装后验证 `git --version`。

第一版可以先支持“检测已有 Git + 引导安装”，后续再做完全自动安装。

### Node.js

建议第一版使用官方 Node.js 二进制包，不直接依赖 nvm，但功能上必须支持类似 nvm 的多版本安装和 `use` 切换。

准备内容：

- macOS arm64 包
- macOS x64 包
- Windows x64 包
- npm 命令代理
- 多版本安装目录
- 当前激活版本状态
- 桌面端版本切换能力
- 可选 `fastbox use node@版本号` 命令行能力
- 国内 npm registry 设置
- `node --version` 验证命令
- `npm --version` 验证命令

国内配置建议：

```bash
npm config set registry https://registry.npmmirror.com
```

### Python

Python 是第一版风险较高的环境，因为 Windows、macOS、pip、PATH、证书和多版本管理都容易出问题。

建议第一版策略：

- 使用官方 Python 安装包或嵌入式包。
- 每个版本放入 Fast Box 管理目录。
- 通过 shim 暴露 `python` 和 `pip`。
- 不覆盖系统 Python。

准备内容：

- macOS arm64 包
- macOS x64 包
- Windows x64 包
- pip 国内源配置
- `python --version` 验证命令
- `pip --version` 验证命令

国内 pip 源可选：

```bash
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

### MySQL

MySQL 推荐第一版优先容器化，而不是直接安装系统服务。

原因：

- MySQL 本机安装和卸载复杂。
- Windows 服务管理麻烦。
- macOS 数据目录、权限和端口也容易出问题。
- 容器方式更接近你的“像 Docker 一样管理环境”的目标。

准备内容：

- 检测 Docker 是否安装。
- 如果 Docker 未安装，提示用户先安装 Docker Desktop。
- 提供 MySQL 容器模板。
- 支持配置端口、root 密码、数据目录。
- 支持启动、停止、删除容器。
- 支持查看连接信息。

第一版 MySQL 可以这样定义：

```text
镜像：mysql:8
端口：3306
数据目录：~/.fastbox/data/mysql/8
验证命令：mysqladmin ping
```

### Rust

Rust 官方推荐使用 rustup。

第一版有两个方案：

- 方案 A：调用 rustup-init，并安装到 Fast Box 管理目录。
- 方案 B：引导用户安装 rustup，Fast Box 只负责检测和配置。

建议第一版使用方案 A，但要设置独立目录：

```text
RUSTUP_HOME=~/.fastbox/packages/rust/rustup
CARGO_HOME=~/.fastbox/packages/rust/cargo
```

然后通过 shim 暴露：

- rustc
- cargo
- rustup

验证命令：

```bash
rustc --version
cargo --version
```

## 国内用户支持

第一版需要重点支持国内下载体验。

可以准备：

- npm 镜像源
- pip 镜像源
- Rust 镜像源
- MySQL Docker 镜像加速配置说明
- GitHub 下载失败时的备用源

但要注意：不要把不稳定、不可验证的第三方下载源作为唯一来源。

建议每个安装包都包含：

- 官方源
- 国内镜像源
- SHA256 校验
- 文件大小
- 版本号

## 环境清单格式草案

```json
{
  "name": "node",
  "displayName": "Node.js",
  "version": "20.11.0",
  "platforms": {
    "macos-arm64": {
      "url": "https://example.com/node-macos-arm64.tar.gz",
      "sha256": "todo"
    },
    "macos-x64": {
      "url": "https://example.com/node-macos-x64.tar.gz",
      "sha256": "todo"
    },
    "windows-x64": {
      "url": "https://example.com/node-windows-x64.zip",
      "sha256": "todo"
    }
  },
  "bin": ["node", "npm", "npx"],
  "verify": [
    "node --version",
    "npm --version"
  ]
}
```

## MVP 开发阶段

### 阶段 1：本地原型

目标：

- 完成 Tauri 应用初始化。
- 实现系统检测。
- 实现环境列表页面。
- 实现安装状态记录。
- 实现日志面板。

### 阶段 2：安装 Node.js

目标：

- 支持下载 Node.js。
- 支持解压到 Fast Box 管理目录。
- 支持生成 shim。
- 支持 PATH 注入。
- 支持验证 `node`、`npm`。

Node.js 是最适合作为第一批试点的环境，因为它相对容易验证，也能快速暴露跨平台问题。

### 阶段 3：扩展 Java、Python、Rust

目标：

- 支持 Java。
- 支持 Python。
- 支持 Rust。
- 支持版本切换。

### 阶段 4：支持 Git 和 MySQL

目标：

- Git 支持检测和安装。
- MySQL 使用容器模板管理。
- 增加服务启动、停止和删除能力。

### 阶段 5：模板系统

目标：

- 支持环境模板。
- 支持一键安装组合环境。
- 支持导出和导入环境清单。

## 你现在需要准备什么

### 1. 准备开发机器

因为第一版要同时支持 macOS 和 Windows，你至少需要：

- 一台 macOS 电脑。
- 一台 Windows 电脑，或者一台 Windows 虚拟机。
- 能够测试 Apple Silicon、Intel macOS 和 Windows x64 会更好。

### 2. 准备基础开发工具

开发 Fast Box 本身需要：

- Node.js
- pnpm 或 npm
- Rust
- Tauri CLI
- Git
- 一个代码编辑器，例如 VS Code

### 3. 准备测试环境

不要直接在自己的主力系统上反复测试安装和卸载。

建议准备：

- macOS 测试用户账号，专门用于 Fast Box 测试。
- Windows 虚拟机快照。
- 每次测试前恢复快照，避免环境污染。

### 4. 准备安装包信息

为第一批环境分别准备：

- 名称
- 版本
- 官方下载地址
- 国内备用下载地址
- SHA256
- 解压或安装方式
- 命令路径
- 验证命令
- 卸载方式

### 5. 准备 Registry 仓库

建议单独创建一个仓库：

```text
fast-box-registry
```

用于维护：

- 环境定义
- 版本定义
- 模板定义
- 下载源定义

### 6. 准备安全规则

Fast Box 不应该随便执行远程脚本。

第一版建议规则：

- 所有远程文件必须校验 SHA256。
- 所有安装步骤必须在本地可见。
- 安装日志必须保存。
- 用户必须能看到安装位置。
- 用户必须能卸载 Fast Box 管理的环境。
- 不默认修改系统关键目录。

## 建议的第一步

第一步不要同时做 6 个环境。

建议先完成：

```text
macOS + Windows 的 Node.js 安装、启用、验证、卸载
```

原因：

- Node.js 有跨平台二进制包。
- 不需要管理员权限。
- 验证简单。
- 能测试下载、解压、shim、PATH、日志、卸载这些核心能力。

只要 Node.js 这条链路跑通，Java、Python、Rust 都可以复用大部分架构。

## 待决策问题

- 第一版是否要求完全离线安装？
- 是否允许用户选择安装目录？
- 是否支持多个版本并存？
- 是否支持自动更新环境？
- 是否内置 Docker Desktop 安装引导？
- 是否提供命令行工具，例如 `fastbox install node`？
- 是否允许社区提交 Registry 配方？
