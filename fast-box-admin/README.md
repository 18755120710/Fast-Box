# Fast Box 管理后台系统 (Fast Box Admin)

这是一个专门提供给 Fast Box 管理者使用的后台管理系统。通过该后台，您可以方便地对系统支持的开发环境套件进行维护，包括但不限于：
1. **添加/删除软件包** (如：添加 `go`, `python` 等新开发环境)
2. **管理软件版本与支持平台** (如：配置不同版本的 `macos-arm64`, `macos-x64`, `windows-x64` 的文件名、下载链接及 SHA256 校验和)
3. **后置校验命令配置** (如：配置各版本的校验脚本 `node --version`)
4. **统一镜像源配置** (如：一键注入国内镜像源、配置包管理器 NPM 国内淘宝镜像)

并且，**客户端应用已经支持动态扫描注册表**。您在此处添加或更新的任何软件包配置都会自动落盘到 `fast-box-registry/packages/` 中，并在重新打开客户端时立即呈现在客户端环境中，无需重新打包客户端！

---

## 技术架构

1. **前端 (Frontend)**: React (TS) + Vite + Tailwind CSS (采用大厂极简亮色主题，与客户端视觉风格保持高度一致)。
2. **后端服务 (Local API)**: 轻量级 Express 本地服务，用于绕过浏览器的沙箱安全限制，直接读写本地 `fast-box-registry/packages/` 下的 JSON 配方文件。

---

## 运行与开发

所有前端依赖安装、脚本执行优先使用 `pnpm` 包管理器。

### 1. 安装依赖

在 `fast-box-admin` 目录下执行：
```bash
pnpm install
```

### 2. 启动开发与管理服务

在 `fast-box-admin` 目录下运行：
```bash
pnpm dev
```
此命令会同时并行启动本地 API 服务（运行在 `3001` 端口）和前端 Vite 开发服务器（运行在 `5174` 端口）。

启动成功后，在浏览器中打开：
👉 [http://localhost:5174](http://localhost:5174)

---

## 项目结构说明

```text
fast-box-admin/
├── package.json              # 依赖与并发运行脚本
├── server.js                 # 本地 Express API 文件读写后端
├── index.html                # 入口 HTML
├── tsconfig.json             # TS 构建参数
├── vite.config.ts            # Vite 配置与 API 路由代理 (/api -> 3001)
└── src/                      # 前端组件源文件
    ├── main.tsx              # React 挂载入口
    ├── index.css             # 引入 Inter 字体与全局过渡
    ├── App.tsx               # 侧边栏框架与状态管理
    └── pages/
        ├── Dashboard.tsx     # 仪表盘：展示软件包与版本数据概览
        ├── PackageList.tsx   # 列表页：查看所有配方文件，支持新建与删除
        ├── PackageEditor.tsx # 编辑器：修改软件参数、bins、激活脚本、各版本平台文件及校验命令
        └── MirrorManager.tsx # 镜像源管理器：一键批量注入国内镜像节点
```
