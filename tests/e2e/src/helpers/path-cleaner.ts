import path from 'path';

/**
 * 清洗 PATH 环境变量，过滤掉宿主系统已有的 node, npm, nvm, pnpm, fnm, volta 等路径，
 * 并把沙箱的 `shims` 目录前置到 PATH 中。
 * 同时继承并注入 `FASTBOX_HOME`。
 */
export function getCleanEnv(sandboxHomeDir: string, sandboxShimsDir: string): Record<string, string> {
  const originalEnv = { ...process.env } as Record<string, string>;
  
  // 查找 PATH 变量的实际 Key（比如 Windows 上可能是 Path）
  const pathKey = Object.keys(originalEnv).find(key => key.toUpperCase() === 'PATH') || 'PATH';
  const originalPath = originalEnv[pathKey] || '';

  // 确定平台对应的路径分隔符 (Windows 为 ';', macOS/Linux 为 ':')
  const pathSeparator = path.delimiter;

  // 需要过滤的敏感词列表
  const keywords = new Set([
    'node', 'npm', 'nvm', 'pnpm', 'fnm', 'volta',
    '.nvm', '.fnm', '.pnpm', '.volta', 'node_modules'
  ]);

  // 拆分路径并过滤
  const pathSegments = originalPath.split(pathSeparator);
  const filteredSegments = pathSegments.filter((segment) => {
    if (!segment) return false;
    // 将路径段按斜杠/反斜杠拆分为各个分量
    const components = segment.split(/[/\\]/);
    // 只有当任意一个分量完全等于敏感词时，才过滤
    return !components.some(comp => keywords.has(comp.toLowerCase()));
  });

  // 将沙箱的 shims 目录前置到 PATH
  filteredSegments.unshift(sandboxShimsDir);

  // 组装新的 PATH
  const cleanPath = filteredSegments.join(pathSeparator);

  // 组装最终的环境变量
  const newEnv: Record<string, string> = {};
  
  // 继承原有环境变量，但剔除 PATH 相关的旧键
  for (const [key, value] of Object.entries(originalEnv)) {
    if (key.toUpperCase() !== 'PATH' && value !== undefined) {
      newEnv[key] = value;
    }
  }

  // 注入清洗后的 PATH 和 FASTBOX_HOME
  newEnv[pathKey] = cleanPath;
  newEnv['FASTBOX_HOME'] = sandboxHomeDir;

  return newEnv;
}
