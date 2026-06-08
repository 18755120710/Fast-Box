import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { setupSandbox, teardownSandbox } from './helpers/sandbox';
import { getCleanEnv } from './helpers/path-cleaner';
import { MockServer, generateMockRecipe } from './helpers/mock-server';
import { generateFixtures } from './helpers/generate-fixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.resolve(__dirname, '../fixtures-tier1');
const recipeTemplatePath = path.resolve(__dirname, '../../../fast-box-registry/packages/node.json');
const binPath = process.env.FASTBOX_APP_BIN || path.resolve(__dirname, '../../../src-tauri/target/debug/fast-box');

let mockServer: MockServer;
let baseUrl: string;
let sandboxContext: any;
let cleanEnv: Record<string, string>;

// 安全地解析 JSON，兼容可能有前缀/后缀日志输出的 stdout
function parseJsonOutput(stdout: string): any {
  const trimStdout = stdout.trim();
  const bracketStart = trimStdout.indexOf('[');
  const bracketEnd = trimStdout.lastIndexOf(']');
  const braceStart = trimStdout.indexOf('{');
  const braceEnd = trimStdout.lastIndexOf('}');

  if (bracketStart !== -1 && bracketEnd !== -1 && (braceStart === -1 || bracketStart < braceStart)) {
    return JSON.parse(trimStdout.substring(bracketStart, bracketEnd + 1));
  }

  if (braceStart !== -1 && braceEnd !== -1) {
    return JSON.parse(trimStdout.substring(braceStart, braceEnd + 1));
  }

  throw new Error(`无法在输出中找到 JSON 对象或数组: ${stdout}`);
}

describe('Fast Box Tier 1 基础功能 E2E 测试', () => {
  beforeAll(async () => {
    // 1. 动态生成 mock 压缩包 fixtures
    await generateFixtures(fixturesDir);

    // 2. 启动 Mock 服务器
    mockServer = new MockServer(fixturesDir);
    baseUrl = await mockServer.start();

    // 3. 初始化隔离沙箱
    sandboxContext = setupSandbox();

    // 4. 生成配方文件指向本地 Mock 服务器
    generateMockRecipe(recipeTemplatePath, sandboxContext.registryDir, fixturesDir, baseUrl);

    // 5. 获取清洗了系统全局 Node 环境并前置了沙箱 shims 目录的 env 环境变量
    cleanEnv = getCleanEnv(sandboxContext.homeDir, sandboxContext.shimsDir);
  });

  afterAll(async () => {
    // 清理沙箱及 Mock 服务器
    if (mockServer) {
      await mockServer.stop();
    }
    if (sandboxContext) {
      await teardownSandbox(sandboxContext.homeDir);
    }
    await fs.remove(fixturesDir);
  });

  describe('特性 1: 获取系统信息 --cli info', () => {
    it('1.1 应返回有效的 JSON 格式', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'info'], { env: cleanEnv });
      const info = parseJsonOutput(stdout);
      expect(info).toBeTypeOf('object');
    });

    it('1.2 返回结果应包含 os, arch, fastbox_home 属性', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'info'], { env: cleanEnv });
      const info = parseJsonOutput(stdout);
      expect(info).toHaveProperty('os');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('fastbox_home');
    });

    it('1.3 返回的 os 属性应该为非空字符串且符合平台规范', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'info'], { env: cleanEnv });
      const info = parseJsonOutput(stdout);
      expect(info.os).toBeTypeOf('string');
      expect(info.os.length).toBeGreaterThan(0);
      expect(['macos', 'windows', 'linux']).toContain(info.os.toLowerCase());
    });

    it('1.4 返回的 arch 属性应该符合架构规范', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'info'], { env: cleanEnv });
      const info = parseJsonOutput(stdout);
      expect(info.arch).toBeTypeOf('string');
      expect(info.arch.length).toBeGreaterThan(0);
      expect(['arm64', 'x64', 'x86']).toContain(info.arch.toLowerCase());
    });

    it('1.5 返回的 fastbox_home 属性应随环境变量 FASTBOX_HOME 的变动而实时变化', async () => {
      const customHome = path.join(sandboxContext.homeDir, 'custom-home-test');
      const tempEnv = { ...cleanEnv, FASTBOX_HOME: customHome };
      const { stdout } = await execa(binPath, ['--cli', 'info'], { env: tempEnv });
      const info = parseJsonOutput(stdout);
      expect(path.resolve(info.fastbox_home)).toBe(path.resolve(customHome));
    });
  });

  describe('特性 2: 获取工具列表 --cli list', () => {
    it('2.1 应返回一个 JSON 数组列表', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    });

    it('2.2 列表项中应该包含正确的 displayName 属性', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg).toBeDefined();
      expect(nodePkg.displayName).toBe('Node.js');
    });

    it('2.3 列表项中应该包含正确的 name 属性', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg.name).toBe('node');
    });

    it('2.4 在没有安装任何版本时，状态字段 status 应该为 not_installed，且已安装列表为空', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg.status).toBe('not_installed');
      expect(nodePkg.installedVersions).toEqual([]);
      expect(nodePkg.activeVersion).toBeFalsy();
    });

    it('2.5 可用版本列表 availableVersions 应当包含配方里定义的所有 Mock 版本', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg.availableVersions).toContain('18.0.0');
      expect(nodePkg.availableVersions).toContain('20.0.0');
      expect(nodePkg.availableVersions).toContain('24.16.0');
    });
  });

  describe('特性 3: 一键安装工具 --cli install <pkg> <ver>', () => {
    it('3.1 可以成功运行安装 node 18.0.0', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'install', 'node', '18.0.0'], { env: cleanEnv });
      expect(stdout).toBeDefined();
    });

    it('3.2 安装后，packages 目录下应该生成对应的版本子文件夹', async () => {
      const versionDir = path.join(sandboxContext.packagesDir, 'node', '18.0.0');
      expect(await fs.pathExists(versionDir)).toBe(true);
      
      const nodeExe = process.platform === 'win32' 
        ? path.join(versionDir, 'node.exe')
        : path.join(versionDir, 'bin/node');
      expect(await fs.pathExists(nodeExe)).toBe(true);
    });

    it('3.3 安装后，shims 目录下应该成功生成对应的转发代理文件', async () => {
      const shimNode = process.platform === 'win32'
        ? path.join(sandboxContext.shimsDir, 'node.cmd')
        : path.join(sandboxContext.shimsDir, 'node');
      expect(await fs.pathExists(shimNode)).toBe(true);
    });

    it('3.4 重复运行安装已安装的版本，应该是幂等的且能正常结束', async () => {
      const { exitCode } = await execa(binPath, ['--cli', 'install', 'node', '18.0.0'], { env: cleanEnv });
      expect(exitCode).toBe(0);
    });

    it('3.5 尝试安装配方中未定义的版本应该抛出错误或安装失败', async () => {
      await expect(
        execa(binPath, ['--cli', 'install', 'node', '99.99.99'], { env: cleanEnv })
      ).rejects.toThrow();
    });

    it('3.6 安装完成后，调用 --cli list 应当看到状态变更为 installed，且已安装列表里包含该版本', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg.status).toBe('installed');
      expect(nodePkg.installedVersions).toContain('18.0.0');
    });
  });

  describe('特性 4: 版本切换与使用 --cli use <pkg> <ver>', () => {
    it('4.1 成功切换到已安装的 node 18.0.0 版本', async () => {
      const { exitCode } = await execa(binPath, ['--cli', 'use', 'node', '18.0.0'], { env: cleanEnv });
      expect(exitCode).toBe(0);
    });

    it('4.2 切换版本后，state/active.json 应被更新并记录当前的激活版本', async () => {
      const activeJsonPath = path.join(sandboxContext.stateDir, 'active.json');
      expect(await fs.pathExists(activeJsonPath)).toBe(true);
      const activeState = await fs.readJson(activeJsonPath);
      expect(activeState.active.node).toBe('18.0.0');
    });

    it('4.3 切换版本后，运行 --cli list 应联动展示 activeVersion 为 18.0.0', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg.activeVersion).toBe('18.0.0');
    });

    it('4.4 尝试切换到未安装的版本应该抛出错误或切换失败，且 active.json 中的值不被破坏', async () => {
      await expect(
        execa(binPath, ['--cli', 'use', 'node', '20.0.0'], { env: cleanEnv })
      ).rejects.toThrow();

      const activeJsonPath = path.join(sandboxContext.stateDir, 'active.json');
      const activeState = await fs.readJson(activeJsonPath);
      expect(activeState.active.node).toBe('18.0.0'); // 依然保持 18.0.0
    });

    it('4.5 安装第二个版本 node 24.16.0 后，在两者间切换，状态文件和列表能正常联动', async () => {
      // 安装 24.16.0
      await execa(binPath, ['--cli', 'install', 'node', '24.16.0'], { env: cleanEnv });

      // 切换到 24.16.0
      await execa(binPath, ['--cli', 'use', 'node', '24.16.0'], { env: cleanEnv });
      let activeState = await fs.readJson(path.join(sandboxContext.stateDir, 'active.json'));
      expect(activeState.active.node).toBe('24.16.0');

      // 切换回 18.0.0
      await execa(binPath, ['--cli', 'use', 'node', '18.0.0'], { env: cleanEnv });
      activeState = await fs.readJson(path.join(sandboxContext.stateDir, 'active.json'));
      expect(activeState.active.node).toBe('18.0.0');
    });
  });

  describe('特性 5: 验证已安装工具 --cli verify <pkg> <ver>', () => {
    it('5.1 运行 verify 应该返回一个 JSON 数组', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'verify', 'node', '18.0.0'], { env: cleanEnv });
      const results = parseJsonOutput(stdout);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('5.2 验证结果的每一项都应该包含 command, success, output, error 等关键属性', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'verify', 'node', '18.0.0'], { env: cleanEnv });
      const results = parseJsonOutput(stdout);
      for (const res of results) {
        expect(res).toHaveProperty('command');
        expect(res).toHaveProperty('success');
        expect(res).toHaveProperty('output');
        expect(res).toHaveProperty('error');
      }
    });

    it('5.3 验证正确的包版本时，所有验证项的 success 应当为 true', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'verify', 'node', '18.0.0'], { env: cleanEnv });
      const results = parseJsonOutput(stdout);
      for (const res of results) {
        expect(res.success).toBe(true);
      }
    });

    it('5.4 验证输出中 node --version 的 output 内容应该包含版本号前缀 v18.0.0', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'verify', 'node', '18.0.0'], { env: cleanEnv });
      const results = parseJsonOutput(stdout);
      const nodeVerify = results.find((r: any) => r.command.includes('node --version'));
      expect(nodeVerify).toBeDefined();
      expect(nodeVerify.output).toContain('v18.0.0');
    });

    it('5.5 尝试验证未安装的版本应当抛出异常或返回 success 含有 false 的校验失败项', async () => {
      await expect(
        execa(binPath, ['--cli', 'verify', 'node', '20.0.0'], { env: cleanEnv })
      ).rejects.toThrow();
    });
  });

  describe('特性 6: 工具安全卸载 --cli uninstall <pkg> <ver>', () => {
    beforeAll(async () => {
      // 保证 18.0.0 (active) 和 24.16.0 都在已安装状态
      await execa(binPath, ['--cli', 'install', 'node', '18.0.0'], { env: cleanEnv });
      await execa(binPath, ['--cli', 'use', 'node', '18.0.0'], { env: cleanEnv });
      await execa(binPath, ['--cli', 'install', 'node', '24.16.0'], { env: cleanEnv });
    });

    it('6.1 可以成功卸载一个已安装但非激活的版本 (node 24.16.0)', async () => {
      const { exitCode } = await execa(binPath, ['--cli', 'uninstall', 'node', '24.16.0'], { env: cleanEnv });
      expect(exitCode).toBe(0);
    });

    it('6.2 卸载后，对应的版本安装文件夹应该被完全清理', async () => {
      const deletedDir = path.join(sandboxContext.packagesDir, 'node', '24.16.0');
      expect(await fs.pathExists(deletedDir)).toBe(false);
    });

    it('6.3 卸载后，列表信息中的已安装版本列表应该不再包含该版本', async () => {
      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg.installedVersions).not.toContain('24.16.0');
    });

    it('6.4 卸载当前处于激活状态的版本 (node 18.0.0) 应被拒绝，active.json 不应被破坏', async () => {
      await expect(
        execa(binPath, ['--cli', 'uninstall', 'node', '18.0.0'], { env: cleanEnv })
      ).rejects.toThrow();
      
      const activeJsonPath = path.join(sandboxContext.stateDir, 'active.json');
      expect(await fs.pathExists(activeJsonPath)).toBe(true);
      const activeState = await fs.readJson(activeJsonPath);
      expect(activeState.active.node).toBe('18.0.0');

      const { stdout } = await execa(binPath, ['--cli', 'list'], { env: cleanEnv });
      const list = parseJsonOutput(stdout);
      const nodePkg = list.find((p: any) => p.name === 'node');
      expect(nodePkg.activeVersion).toBe('18.0.0');
    });

    it('6.5 拒绝卸载已激活版本后，对应 shims 下的代理转发文件仍应可用', async () => {
      const shimNode = process.platform === 'win32'
        ? path.join(sandboxContext.shimsDir, 'node.cmd')
        : path.join(sandboxContext.shimsDir, 'node');
      
      expect(await fs.pathExists(shimNode)).toBe(true);
      const { stdout } = await execa(shimNode, ['--version'], { env: cleanEnv });
      expect(stdout.trim()).toBe('v18.0.0');
    });

    it('6.6 卸载未安装的版本应该是幂等的，不报错且安全退出', async () => {
      const { exitCode } = await execa(binPath, ['--cli', 'uninstall', 'node', '20.0.0'], { env: cleanEnv });
      expect(exitCode).toBe(0);
    });
  });

  describe('特性 7: shims 的转发逻辑', () => {
    const shimNode = process.platform === 'win32'
      ? 'node.cmd'
      : 'node';
    const shimNpm = process.platform === 'win32'
      ? 'npm.cmd'
      : 'npm';

    beforeAll(async () => {
      // 重新安装 node 18.0.0 和 24.16.0 用于 shims 测试
      await execa(binPath, ['--cli', 'install', 'node', '18.0.0'], { env: cleanEnv });
      await execa(binPath, ['--cli', 'install', 'node', '24.16.0'], { env: cleanEnv });
    });

    it('7.1 当没有版本激活时，直接执行 shims 下的 node 应该报错', async () => {
      // 卸载或清除 active.json 激活状态
      const activeJsonPath = path.join(sandboxContext.stateDir, 'active.json');
      await fs.writeJson(activeJsonPath, { active: {} });

      const nodePath = path.join(sandboxContext.shimsDir, shimNode);
      await expect(
        execa(nodePath, ['--version'], { env: cleanEnv })
      ).rejects.toThrow();
    });

    it('7.2 激活 node 18.0.0 时，运行 shims 目录下的 node 应当输出 "v18.0.0"', async () => {
      await execa(binPath, ['--cli', 'use', 'node', '18.0.0'], { env: cleanEnv });

      const nodePath = path.join(sandboxContext.shimsDir, shimNode);
      const { stdout } = await execa(nodePath, ['--version'], { env: cleanEnv });
      expect(stdout.trim()).toBe('v18.0.0');
    });

    it('7.3 激活 node 24.16.0 时，运行 shims 目录下的 node 应当能够实时切换输出 "v24.16.0"', async () => {
      await execa(binPath, ['--cli', 'use', 'node', '24.16.0'], { env: cleanEnv });

      const nodePath = path.join(sandboxContext.shimsDir, shimNode);
      const { stdout } = await execa(nodePath, ['--version'], { env: cleanEnv });
      expect(stdout.trim()).toBe('v24.16.0');
    });

    it('7.4 运行 shims 目录下的 npm 能够输出 mock 的 npm 版本 (10.0.0)', async () => {
      const npmPath = path.join(sandboxContext.shimsDir, shimNpm);
      const { stdout } = await execa(npmPath, ['--version'], { env: cleanEnv });
      expect(stdout.trim()).toBe('10.0.0');
    });

    it('7.5 运行 shims 目录下的 npm config get registry 时，能够输出自定义的镜像源地址', async () => {
      const npmPath = path.join(sandboxContext.shimsDir, shimNpm);
      const { stdout } = await execa(npmPath, ['config', 'get', 'registry'], { env: cleanEnv });
      expect(stdout.trim()).toBe('https://registry.npmmirror.com');
    });
  });
});
