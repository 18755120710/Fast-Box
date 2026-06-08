import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { setupSandbox, teardownSandbox } from './helpers/sandbox';
import { getCleanEnv } from './helpers/path-cleaner';
import { MockServer, generateMockRecipe, calculateSha256 } from './helpers/mock-server';
import { generateFixtures } from './helpers/generate-fixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.resolve(__dirname, '../fixtures-infrastructure');
const recipeTemplatePath = path.resolve(__dirname, '../../../fast-box-registry/packages/node.json');

describe('E2E 测试基础设施验证', () => {
  beforeAll(async () => {
    // 自动为测试生成压缩包 fixtures
    await generateFixtures(fixturesDir);
  });

  afterAll(async () => {
    // 测试结束后清理 fixtures 文件夹，保持仓库整洁
    await fs.remove(fixturesDir);
  });

  it('1. 沙箱管理器应该能正确创建和清理隔离目录', async () => {
    const originalFastboxHome = process.env.FASTBOX_HOME;
    
    const context = setupSandbox();
    
    expect(context.homeDir).toContain('fastbox-e2e-');
    expect(fs.existsSync(context.homeDir)).toBe(true);
    expect(fs.existsSync(context.packagesDir)).toBe(true);
    expect(fs.existsSync(context.shimsDir)).toBe(true);
    expect(fs.existsSync(context.registryDir)).toBe(true);
    expect(process.env.FASTBOX_HOME).toBe(context.homeDir);

    await teardownSandbox(context.homeDir);
    expect(fs.existsSync(context.homeDir)).toBe(false);

    // 恢复原有的环境变量
    if (originalFastboxHome) {
      process.env.FASTBOX_HOME = originalFastboxHome;
    } else {
      delete process.env.FASTBOX_HOME;
    }
  });

  it('2. 环境变量清洗器应该能净化 PATH 并前置 shims', () => {
    const sandboxHomeDir = '/fake/sandbox/home';
    const sandboxShimsDir = '/fake/sandbox/shims';
    
    // 注入一个包含敏感词的 PATH 变量进行测试
    const originalPath = process.env.PATH || '';
    const fakePath = [
      '/usr/bin',
      '/Users/test/.nvm/versions/node/v20.0.0/bin',
      '/usr/local/bin',
      '/Users/test/.fnm/bin',
      '/Users/test/.pnpm-global/bin',
      '/Users/test/.volta/bin',
      '/Users/node-dev/bin',
    ].join(path.delimiter);

    process.env.PATH = fakePath;

    try {
      const cleanEnv = getCleanEnv(sandboxHomeDir, sandboxShimsDir);
      
      const pathKey = Object.keys(cleanEnv).find(key => key.toUpperCase() === 'PATH') || 'PATH';
      const cleanPath = cleanEnv[pathKey];
      
      const pathSegments = cleanPath.split(path.delimiter);

      // 第一项必须是沙箱的 shims 目录
      expect(pathSegments[0]).toBe(sandboxShimsDir);

      // 验证清洗后的精确结果
      expect(pathSegments).toEqual([
        sandboxShimsDir,
        '/usr/bin',
        '/usr/local/bin',
        '/Users/test/.pnpm-global/bin',
        '/Users/node-dev/bin'
      ]);

      // 正确注入 FASTBOX_HOME
      expect(cleanEnv['FASTBOX_HOME']).toBe(sandboxHomeDir);
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it('3. Fixtures 应该成功生成对应的 Mock 压缩包且内容符合 bins 规范', async () => {
    const testVersions = ['24.16.0', '18.0.0', '20.0.0'];
    for (const version of testVersions) {
      const armTar = path.join(fixturesDir, `node-v${version}-darwin-arm64.tar.xz`);
      const x64Tar = path.join(fixturesDir, `node-v${version}-darwin-x64.tar.xz`);
      const winZip = path.join(fixturesDir, `node-v${version}-win-x64.zip`);

      expect(fs.existsSync(armTar)).toBe(true);
      expect(fs.existsSync(x64Tar)).toBe(true);
      expect(fs.existsSync(winZip)).toBe(true);

      // 验证 SHA256 可计算且长度合规
      const hash1 = calculateSha256(armTar);
      const hash2 = calculateSha256(x64Tar);
      const hash3 = calculateSha256(winZip);

      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash3).toHaveLength(64);
    }
  });

  it('4. Mock 服务器与配方生成器应能联动成功并生成正确的配方 JSON', async () => {
    const server = new MockServer(fixturesDir);
    const baseUrl = await server.start();
    expect(baseUrl).toContain('http://127.0.0.1:');

    const context = setupSandbox();

    try {
      generateMockRecipe(recipeTemplatePath, context.registryDir, fixturesDir, baseUrl);

      const generatedRecipePath = path.join(context.registryDir, 'node.json');
      expect(fs.existsSync(generatedRecipePath)).toBe(true);

      const recipe = fs.readJsonSync(generatedRecipePath);

      // 验证 3 个版本都已定义
      expect(recipe.versions['24.16.0']).toBeDefined();
      expect(recipe.versions['18.0.0']).toBeDefined();
      expect(recipe.versions['20.0.0']).toBeDefined();

      // 验证其中的一个版本（例如 18.0.0）配置
      const v18 = recipe.versions['18.0.0'];
      expect(v18.version).toBe('18.0.0');

      // macos-arm64
      const macArm = v18.platforms['macos-arm64'];
      expect(macArm.fileName).toBe('node-v18.0.0-darwin-arm64.tar.xz');
      expect(macArm.officialUrl).toBe(`${baseUrl}/download/node-v18.0.0-darwin-arm64.tar.xz`);
      expect(macArm.mirrorUrls[0]).toBe(`${baseUrl}/download/node-v18.0.0-darwin-arm64.tar.xz`);
      expect(macArm.sha256).toBe(calculateSha256(path.join(fixturesDir, 'node-v18.0.0-darwin-arm64.tar.xz')));

      // windows-x64
      const winX64 = v18.platforms['windows-x64'];
      expect(winX64.fileName).toBe('node-v18.0.0-win-x64.zip');
      expect(winX64.officialUrl).toBe(`${baseUrl}/download/node-v18.0.0-win-x64.zip`);
      expect(winX64.sha256).toBe(calculateSha256(path.join(fixturesDir, 'node-v18.0.0-win-x64.zip')));

      // 验证下载路由响应
      const response = await fetch(`${baseUrl}/download/node-v18.0.0-darwin-arm64.tar.xz`);
      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    } finally {
      await server.stop();
      await teardownSandbox(context.homeDir);
    }
  });
});
