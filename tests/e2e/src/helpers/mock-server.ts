import http from 'http';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';

export class MockServer {
  private server: http.Server | null = null;
  private port = 0;
  private fixturesDir: string;

  constructor(fixturesDir: string) {
    this.fixturesDir = fixturesDir;
  }

  /**
   * 启动 Mock 服务器，监听随机空闲端口。
   * 返回 baseUrl: http://127.0.0.1:port
   */
  public start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = req.url || '';
        
        // 路由匹配：/download/:fileName
        const match = url.match(/^\/download\/(.+)$/);
        if (match && req.method === 'GET') {
          const fileName = decodeURIComponent(match[1]);
          // 路径遍历安全防御
          if (fileName.includes('..') || path.isAbsolute(fileName)) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad Request');
            return;
          }
          const filePath = path.join(this.fixturesDir, fileName);
          if (fs.existsSync(filePath)) {
            res.writeHead(200, {
              'Content-Type': 'application/octet-stream',
              'Content-Length': fs.statSync(filePath).size,
            });
            fs.createReadStream(filePath).pipe(res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`File not found: ${fileName}`);
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          resolve(`http://127.0.0.1:${this.port}`);
        } else {
          reject(new Error('未能成功分配服务器端口'));
        }
      });
    });
  }

  /**
   * 停止 Mock 服务器
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.port;
  }

  public getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }
}

/**
 * 计算文件的真实 SHA256 哈希值
 */
export function calculateSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`计算 SHA256 错误：文件不存在 - ${filePath}`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * 读取原始 fast-box-registry/packages/node.json 模板，
 * 动态修改所有版本的 officialUrl、mirrorUrls 指向本地 Mock 服务器下载路径，
 * 并将 sha256 覆写为 Mock 服务器中该测试压缩包的实际 SHA256 校验值。
 * 最后把修改后的配方 JSON 写回沙箱的 registry/packages/node.json 目录。
 */
export function generateMockRecipe(
  recipeTemplatePath: string,
  sandboxRegistryDir: string,
  fixturesDir: string,
  baseUrl: string
): void {
  if (!fs.existsSync(recipeTemplatePath)) {
    throw new Error(`配方模板文件未找到: ${recipeTemplatePath}`);
  }
  const template = fs.readJsonSync(recipeTemplatePath);

  const testVersions = ['24.16.0', '18.0.0', '20.0.0'];
  const newVersions: Record<string, any> = {};

  const baseVersionConfig = template.versions['24.16.0'];
  if (!baseVersionConfig) {
    throw new Error(`配方模板中缺少 24.16.0 版本配置信息`);
  }

  for (const version of testVersions) {
    const versionConfig = JSON.parse(JSON.stringify(baseVersionConfig));
    versionConfig.version = version;

    for (const [platformKey, platformConfig] of Object.entries(versionConfig.platforms) as [string, any][]) {
      let fileName = '';
      let archiveRoot = '';
      if (platformKey === 'macos-arm64') {
        fileName = `node-v${version}-darwin-arm64.tar.xz`;
        archiveRoot = `node-v${version}-darwin-arm64`;
      } else if (platformKey === 'macos-x64') {
        fileName = `node-v${version}-darwin-x64.tar.xz`;
        archiveRoot = `node-v${version}-darwin-x64`;
      } else if (platformKey === 'windows-x64') {
        fileName = `node-v${version}-win-x64.zip`;
        archiveRoot = `node-v${version}-win-x64`;
      } else {
        throw new Error(`未支持的测试平台: ${platformKey}`);
      }

      const filePath = path.join(fixturesDir, fileName);
      const fileSha256 = calculateSha256(filePath);

      platformConfig.fileName = fileName;
      platformConfig.archiveRoot = archiveRoot;
      platformConfig.officialUrl = `${baseUrl}/download/${fileName}`;
      platformConfig.mirrorUrls = [`${baseUrl}/download/${fileName}`];
      platformConfig.sha256 = fileSha256;
    }

    if (versionConfig.verify && versionConfig.verify.length > 0) {
      versionConfig.verify[0].expectedPrefix = `v${version}`;
    }

    newVersions[version] = versionConfig;
  }

  template.versions = newVersions;

  const targetPath = path.join(sandboxRegistryDir, 'node.json');
  fs.writeJsonSync(targetPath, template, { spaces: 2 });
}
