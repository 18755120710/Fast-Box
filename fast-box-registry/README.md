# fast-box-registry

Fast Box Registry 用于维护 Fast Box 可安装环境和环境模板。

这个仓库不负责执行安装逻辑，只负责提供可信的安装元数据，例如版本、下载地址、校验值、命令入口、验证命令和卸载策略。

## 目录结构

```text
fast-box-registry/
  packages/
    node.json
  templates/
    frontend.json
  schemas/
    package.schema.json
```

## 目录说明

### packages

每个文件描述一个可安装环境，以及这个环境支持的多个版本。

例如：

- `node.json`
- `java.json`
- `python.json`
- `git.json`
- `mysql.json`
- `rust.json`

### templates

每个文件描述一个组合环境。

例如：

- `frontend.json`
- `java-backend.json`
- `python-basic.json`
- `rust-dev.json`
- `fullstack-basic.json`

### schemas

用于约束 Registry 文件结构，方便后续做校验、自动补全和 CI 检查。

## 第一版设计原则

- 默认使用官方源。
- 国内镜像源只作为备用源。
- 所有下载文件必须配置 SHA256。
- 优先使用 zip、tar.xz、tar.gz 这类可解压包。
- 尽量避免第一版直接使用系统安装器。
- 安装到 Fast Box 自己管理的目录。
- 通过 shims 暴露命令，实现全局可用和多版本切换。

## 多版本切换设计

Fast Box 必须支持类似 nvm 的多版本切换。

Fast Box 的主入口是桌面端 UI，不是 CLI。用户应该主要通过环境详情页安装版本、切换版本和卸载版本。

核心规则：

- 同一个环境可以安装多个版本。
- 每个版本安装到独立目录。
- PATH 只加入 `{fastbox_home}/shims`，不直接加入具体版本目录。
- 桌面端切换版本时，只修改当前激活版本状态。
- 可选 CLI 的 `use` 命令和桌面端切换按钮做同一件事。
- 用户执行 `node`、`npm`、`python`、`java` 等命令时，shim 根据当前激活版本转发到真实二进制文件。

示例目录：

```text
~/.fastbox/
  packages/
    node/
      22.17.0/
      24.16.0/
  shims/
    node
    npm
    npx
  state/
    active.json
```

示例状态：

```json
{
  "active": {
    "node": "24.16.0"
  }
}
```

桌面端操作示例：

```text
打开 Fast Box
进入 Node.js 详情页
安装 24.16.0
安装 22.17.0
将 24.16.0 设为当前版本
终端执行 node --version
将 22.17.0 设为当前版本
终端执行 node --version
```

可选 CLI 等价命令：

```bash
fastbox install node@24.16.0
fastbox install node@22.17.0
fastbox use node@24.16.0
node --version
```

执行 `fastbox use node@22.17.0` 后，`node --version` 应该切换到 `v22.17.0`。

## Node.js 第一版策略

Node.js 不使用 `.pkg` 或 `.msi` 安装器，而是使用官方压缩包：

- macOS Apple Silicon: `darwin-arm64.tar.xz`
- macOS Intel: `darwin-x64.tar.xz`
- Windows x64: `win-x64.zip`

这样可以避免管理员权限，方便隔离安装、版本切换和卸载。
