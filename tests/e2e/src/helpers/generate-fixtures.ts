import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';

/**
 * 动态在 fixturesDir 目录下打包生成 mock 压缩包文件：
 * 包含的 Mock 版本有：24.16.0、18.0.0、20.0.0
 * 对应的包如 node-v24.16.0-darwin-arm64.tar.xz、node-v24.16.0-darwin-x64.tar.xz 以及 windows 版 node-v24.16.0-win-x64.zip
 */
export async function generateFixtures(fixturesDir: string): Promise<void> {
  await fs.ensureDir(fixturesDir);

  const versions = ['24.16.0', '18.0.0', '20.0.0'];
  const tempDir = path.join(fixturesDir, 'temp_build');
  await fs.ensureDir(tempDir);

  try {
    for (const version of versions) {
      // 1. 生成 macOS darwin-arm64 (.tar.xz)
      await buildTarXz(version, 'darwin-arm64', fixturesDir, tempDir);
      // 2. 生成 macOS darwin-x64 (.tar.xz)
      await buildTarXz(version, 'darwin-x64', fixturesDir, tempDir);
      // 3. 生成 Windows win-x64 (.zip)
      await buildZip(version, 'win-x64', fixturesDir, tempDir);
    }
  } finally {
    // 强制清理临时编译目录
    await fs.remove(tempDir);
  }
}

async function buildTarXz(version: string, platform: string, fixturesDir: string, tempDir: string) {
  const archiveRoot = `node-v${version}-${platform}`;
  const rootPath = path.join(tempDir, archiveRoot);
  
  await fs.ensureDir(rootPath);
  const binDir = path.join(rootPath, 'bin');
  await fs.ensureDir(binDir);

  const nodeContent = `#!/bin/sh\necho 'v${version}'\n`;
  const npmContent = `#!/bin/sh\nif [ "$1" = 'config' ] && [ "$2" = 'get' ] && [ "$3" = 'registry' ]; then\n  echo 'https://registry.npmmirror.com'\nelse\n  echo '10.0.0'\nfi\n`;
  const npxContent = `#!/bin/sh\necho '10.0.0'\n`;

  const nodePath = path.join(binDir, 'node');
  const npmPath = path.join(binDir, 'npm');
  const npxPath = path.join(binDir, 'npx');

  await fs.writeFile(nodePath, nodeContent, { mode: 0o755 });
  await fs.writeFile(npmPath, npmContent, { mode: 0o755 });
  await fs.writeFile(npxPath, npxContent, { mode: 0o755 });

  const archiveName = `${archiveRoot}.tar.xz`;
  const archivePath = path.join(fixturesDir, archiveName);

  // 在 tempDir 下执行打包命令以保持包内路径干净
  // tar -cJf <archivePath> -C <tempDir> <archiveRoot>
  try {
    await execa('tar', ['-cJf', archivePath, '-C', tempDir, archiveRoot]);
  } catch (err) {
    if (process.platform === 'win32') {
      console.warn(`Warning: Failed to build tar.xz on Windows for ${archiveRoot}:`, err);
    } else {
      throw err;
    }
  }
  
  // 清理当前版本的临时源码目录
  await fs.remove(rootPath);
}

async function buildZip(version: string, platform: string, fixturesDir: string, tempDir: string) {
  const archiveRoot = `node-v${version}-${platform}`;
  const rootPath = path.join(tempDir, archiveRoot);
  
  await fs.ensureDir(rootPath);

  const nodeContent = `#!/bin/sh\necho 'v${version}'\n`;
  const npmContent = `@echo off\nif "%1"=="config" if "%2"=="get" if "%3"=="registry" (\n  echo https://registry.npmmirror.com\n) else (\n  echo 10.0.0\n)\n`;
  const npxContent = `@echo off\necho 10.0.0\n`;

  const nodePath = path.join(rootPath, 'node.exe');
  const npmPath = path.join(rootPath, 'npm.cmd');
  const npxPath = path.join(rootPath, 'npx.cmd');

  if (process.platform === 'win32') {
    const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
    if (await fs.pathExists(cscPath)) {
      const csPath = path.join(rootPath, 'node.cs');
      const csContent = `using System;
class Program {
    static void Main(string[] args) {
        bool hasConfig = false;
        bool hasGet = false;
        bool hasRegistry = false;
        for (int i = 0; i < args.Length; i++) {
            if (args[i] == "config") hasConfig = true;
            if (args[i] == "get") hasGet = true;
            if (args[i] == "registry") hasRegistry = true;
        }
        if (hasConfig && hasGet && hasRegistry) {
            Console.WriteLine("https://registry.npmmirror.com");
        } else {
            Console.WriteLine("v${version}");
        }
    }
}`;
      await fs.writeFile(csPath, csContent, 'utf8');
      try {
        await execa(cscPath, ['/out:' + nodePath, csPath]);
      } catch (err) {
        console.warn('Warning: csc compilation failed, fallback to dummy node.exe', err);
        await fs.writeFile(nodePath, nodeContent, { mode: 0o755 });
      } finally {
        await fs.remove(csPath);
      }
    } else {
      await fs.writeFile(nodePath, nodeContent, { mode: 0o755 });
    }
  } else {
    await fs.writeFile(nodePath, nodeContent, { mode: 0o755 });
  }

  await fs.writeFile(npmPath, npmContent, { mode: 0o755 });
  await fs.writeFile(npxPath, npxContent, { mode: 0o755 });

  const archiveName = `${archiveRoot}.zip`;
  const archivePath = path.join(fixturesDir, archiveName);

  if (process.platform === 'win32') {
    await execa('powershell', ['-Command', `Compress-Archive -Path '${rootPath}' -DestinationPath '${archivePath}' -Force`]);
  } else {
    // zip -r <archivePath> <archiveRoot>
    await execa('zip', ['-r', archivePath, archiveRoot], { cwd: tempDir });
  }
  
  // 清理当前版本的临时源码目录
  await fs.remove(rootPath);
}
