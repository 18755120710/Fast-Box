import os from 'os';
import path from 'path';
import fs from 'fs-extra';

export interface SandboxContext {
  homeDir: string;
  packagesDir: string;
  shimsDir: string;
  stateDir: string;
  cacheDir: string;
  logsDir: string;
  registryDir: string;
}

/**
 * 动态创建系统临时文件夹下的唯一目录（以 fastbox-e2e- 开头），并创建所需的子文件夹。
 * 同时在 process.env.FASTBOX_HOME 中注入该临时目录。
 */
export function setupSandbox(): SandboxContext {
  const tempPrefix = path.join(os.tmpdir(), 'fastbox-e2e-');
  const homeDir = fs.mkdtempSync(tempPrefix);

  const context: SandboxContext = {
    homeDir,
    packagesDir: path.join(homeDir, 'packages'),
    shimsDir: path.join(homeDir, 'shims'),
    stateDir: path.join(homeDir, 'state'),
    cacheDir: path.join(homeDir, 'cache'),
    logsDir: path.join(homeDir, 'logs'),
    registryDir: path.join(homeDir, 'registry/packages'),
  };

  // 递归创建子文件夹
  fs.ensureDirSync(context.packagesDir);
  fs.ensureDirSync(context.shimsDir);
  fs.ensureDirSync(context.stateDir);
  fs.ensureDirSync(context.cacheDir);
  fs.ensureDirSync(context.logsDir);
  fs.ensureDirSync(context.registryDir);

  // 注入环境变量
  process.env.FASTBOX_HOME = homeDir;

  return context;
}

/**
 * 递归强力删除沙箱目录，支持重试，防止由于文件锁定等原因删除失败。
 */
export async function teardownSandbox(homeDir: string, retries = 5, delay = 200): Promise<void> {
  if (!homeDir || !homeDir.includes('fastbox-e2e-')) {
    // 安全检查，防范误删非沙箱的系统目录
    throw new Error(`安全防御：拒绝删除非沙箱目录 - ${homeDir}`);
  }

  try {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (await fs.pathExists(homeDir)) {
          await fs.remove(homeDir);
        }
        return;
      } catch (error) {
        if (attempt === retries) {
          throw new Error(`删除沙箱目录 ${homeDir} 失败，尝试了 ${retries} 次: ${(error as Error).message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  } finally {
    delete process.env.FASTBOX_HOME;
  }
}
