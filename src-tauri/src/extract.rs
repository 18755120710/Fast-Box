use std::fs::{self, File};
use std::path::{Path, PathBuf, Component};
use std::io::{self, Read};
use tar::Archive;
use zip::ZipArchive;
use xz2::read::XzDecoder;
use thiserror::Error;

/// 解压缩和安装过程中可能出现的异常错误定义
#[derive(Error, Debug)]
pub enum ExtractError {
    #[error("I/O 错误: {0}")]
    Io(#[from] io::Error),

    #[error("Zip 格式解密或读取错误: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("不支持的归档文件类型: {0}")]
    UnsupportedArchive(String),

    #[error("归档包缺少预期的根目录 '{expected}'，在路径 '{actual}' 处不匹配")]
    InvalidArchiveRoot {
        expected: String,
        actual: PathBuf,
    },

    #[error("路径遍历漏洞攻击防御：检测到非法的解压路径: {0}")]
    PathTraversal(PathBuf),

    #[error("无效的符号链接目标: {0:?} -> {1:?}")]
    InvalidSymlink(PathBuf, PathBuf),

    #[error("目标安装目录已存在: {0}")]
    TargetExists(PathBuf),

    #[error("重命名临时目录失败: {0}")]
    RenameFailed(io::Error),
}

/// 支持的归档文件格式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveType {
    TarXz,
    Zip,
}

impl ArchiveType {
    /// 根据文件路径后缀自动推断归档文件类型
    pub fn from_path(path: &Path) -> Result<Self, String> {
        let filename = path.file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_lowercase())
            .ok_or_else(|| "文件名无效".to_string())?;

        if filename.ends_with(".tar.xz") || filename.ends_with(".txz") {
            Ok(ArchiveType::TarXz)
        } else if filename.ends_with(".zip") {
            Ok(ArchiveType::Zip)
        } else {
            Err(format!("不支持的文件扩展名: {}", filename))
        }
    }
}

/// 规范化路径以展开所有的 `.` 和 `..` (纯路径计算，不访问真实文件系统)
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                match components.last() {
                    Some(Component::Normal(_)) => {
                        components.pop();
                    }
                    Some(Component::ParentDir) => {
                        components.push(component);
                    }
                    None => {
                        components.push(component);
                    }
                    _ => {}
                }
            }
            Component::CurDir => {}
            c => {
                components.push(c);
            }
        }
    }
    components.into_iter().collect()
}

/// 检查路径是否安全，防止路径遍历攻击 (Zip Slip / Tar Bomb)
fn is_path_safe(stripped_path: &Path) -> bool {
    for component in stripped_path.components() {
        match component {
            Component::ParentDir => return false,
            Component::RootDir => return false,
            Component::Prefix(_) => return false,
            _ => {}
        }
    }
    true
}

fn is_ignored_archive_metadata(path: &Path) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|part| part == "__MACOSX" || part.starts_with("._"))
    })
}

/// 校验符号链接的目标地址是否安全 (不会逃逸 target_dir)
fn is_symlink_safe(symlink_pos: &Path, target: &Path, target_dir: &Path) -> bool {
    // 绝对路径符号链接在便携安装包中通常是不安全的，且易导致逃逸
    if target.is_absolute() {
        return false;
    }

    if let Some(parent) = symlink_pos.parent() {
        let resolved = parent.join(target);
        let normalized = normalize_path(&resolved);
        return normalized.starts_with(target_dir);
    }
    false
}

/// 解压并安装软件包（入口函数）
///
/// 采用“事务性/原子性”写入机制：
/// 1. 检验目标目录 `target_dir` 是否存在。
/// 2. 在同级目录下创建 `.tmp` 临时工作目录。
/// 3. 执行解压，并根据 `archive_root` 自动“去包裹”。
/// 4. 解压成功后，原子性地将 `.tmp` 目录重命名为 `target_dir`。
/// 5. 解压失败时，自动清理临时目录，避免残留受损文件。
pub fn extract_package(
    archive_path: &Path,
    target_dir: &Path,
    archive_root: Option<&str>,
) -> Result<(), ExtractError> {
    // 1. 如果目标目录已经存在，防止重复覆盖
    if target_dir.exists() {
        return Err(ExtractError::TargetExists(target_dir.to_path_buf()));
    }

    // 2. 创建临时解压目录
    let temp_dir = target_dir.with_extension("tmp");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
    }
    fs::create_dir_all(&temp_dir)?;

    // 3. 推断归档文件类型
    let archive_type = ArchiveType::from_path(archive_path)
        .map_err(ExtractError::UnsupportedArchive)?;

    // 4. 执行对应的解压逻辑
    let extract_result = match archive_type {
        ArchiveType::TarXz => extract_tar_xz(archive_path, &temp_dir, archive_root),
        ArchiveType::Zip => extract_zip(archive_path, &temp_dir, archive_root),
    };

    // 5. 错误处理与清理
    if let Err(err) = extract_result {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(err);
    }

    // 6. 原子重命名，完成安装
    fs::rename(&temp_dir, target_dir).map_err(ExtractError::RenameFailed)?;

    Ok(())
}

/// Tar.xz 格式解压缩实现
fn extract_tar_xz(
    archive_path: &Path,
    target_dir: &Path,
    archive_root: Option<&str>,
) -> Result<(), ExtractError> {
    let file = File::open(archive_path)?;
    let decompressor = XzDecoder::new(file);
    let mut archive = Archive::new(decompressor);

    if let Some(root_prefix) = archive_root {
        let root_path = Path::new(root_prefix);

        for entry_res in archive.entries()? {
            let mut entry = entry_res?;
            let entry_path = entry.path()?.to_path_buf();

            if is_ignored_archive_metadata(&entry_path) {
                continue;
            }

            // 去包裹逻辑：剥离顶层冗余目录
            if let Ok(stripped_path) = entry_path.strip_prefix(root_path) {
                // 如果剥离后为空，说明是顶层目录本身，直接略过
                if stripped_path.as_os_str().is_empty() {
                    continue;
                }

                // 路径安全校验
                if !is_path_safe(stripped_path) {
                    return Err(ExtractError::PathTraversal(entry_path));
                }

                let out_path = target_dir.join(stripped_path);

                // 创建父级目录结构
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                // 软链接安全性校验，防止路径逃逸
                let entry_type = entry.header().entry_type();
                if entry_type.is_symlink() || entry_type.is_hard_link() {
                    if let Some(link_target) = entry.link_name()? {
                        if !is_symlink_safe(&out_path, &link_target, target_dir) {
                            return Err(ExtractError::InvalidSymlink(out_path, link_target.into_owned()));
                        }
                    }
                }

                // 解压缩当前条目到目标路径
                entry.unpack(&out_path)?;
            } else {
                return Err(ExtractError::InvalidArchiveRoot {
                    expected: root_prefix.to_string(),
                    actual: entry_path,
                });
            }
        }
    } else {
        // 无需剥离顶层目录，直接解压
        for entry_res in archive.entries()? {
            let mut entry = entry_res?;
            let entry_path = entry.path()?.to_path_buf();

            if is_ignored_archive_metadata(&entry_path) {
                continue;
            }

            if !is_path_safe(&entry_path) {
                return Err(ExtractError::PathTraversal(entry_path));
            }

            let out_path = target_dir.join(&entry_path);
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }

            // 软链接安全性校验，防止路径逃逸
            let entry_type = entry.header().entry_type();
            if entry_type.is_symlink() || entry_type.is_hard_link() {
                if let Some(link_target) = entry.link_name()? {
                    if !is_symlink_safe(&out_path, &link_target, target_dir) {
                        return Err(ExtractError::InvalidSymlink(out_path, link_target.into_owned()));
                    }
                }
            }

            entry.unpack(out_path)?;
        }
    }

    Ok(())
}

/// Zip 格式解压缩实现
fn extract_zip(
    archive_path: &Path,
    target_dir: &Path,
    archive_root: Option<&str>,
) -> Result<(), ExtractError> {
    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)?;

    if let Some(root_prefix) = archive_root {
        let root_path = Path::new(root_prefix);

        for i in 0..archive.len() {
            let mut zip_file = archive.by_index(i)?;
            let zip_name = zip_file.name();

            // 兼容部分含有反斜杠的异常 ZIP 格式
            let entry_path = Path::new(zip_name);

            if is_ignored_archive_metadata(entry_path) {
                continue;
            }

            // 去包裹逻辑：剥离顶层冗余目录
            if let Ok(stripped_path) = entry_path.strip_prefix(root_path) {
                if stripped_path.as_os_str().is_empty() {
                    continue;
                }

                // 路径安全校验
                if !is_path_safe(stripped_path) {
                    return Err(ExtractError::PathTraversal(entry_path.to_path_buf()));
                }

                let out_path = target_dir.join(stripped_path);

                if zip_file.is_dir() {
                    fs::create_dir_all(&out_path)?;
                } else {
                    if let Some(parent) = out_path.parent() {
                        fs::create_dir_all(parent)?;
                    }

                    // Unix 平台下的符号链接特殊处理
                    #[cfg(unix)]
                    {
                        if let Some(mode) = zip_file.unix_mode() {
                            // 符号链接标识位检测 0o120000 (S_IFLNK)
                            if (mode & 0o170000) == 0o120000 {
                                let mut symlink_target = Vec::new();
                                zip_file.read_to_end(&mut symlink_target)?;
                                let target_str = String::from_utf8(symlink_target)
                                    .map_err(|_| ExtractError::InvalidSymlink(
                                        out_path.clone(),
                                        PathBuf::from("<invalid utf-8>"),
                                    ))?;
                                let target_path = Path::new(&target_str);

                                // 符号链接安全性检查，防止逃逸安装根目录
                                if !is_symlink_safe(&out_path, target_path, target_dir) {
                                    return Err(ExtractError::InvalidSymlink(out_path, target_path.to_path_buf()));
                                }

                                // 如果已经存在同名符号链接或文件，先清理
                                if out_path.exists() || fs::symlink_metadata(&out_path).is_ok() {
                                    let _ = fs::remove_file(&out_path);
                                }
                                std::os::unix::fs::symlink(target_path, &out_path)?;
                                continue;
                            }
                        }
                    }

                    // 写入普通文件
                    let mut outfile = File::create(&out_path)?;
                    io::copy(&mut zip_file, &mut outfile)?;

                    // Unix 平台下恢复文件可执行等权限
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        if let Some(mode) = zip_file.unix_mode() {
                            fs::set_permissions(&out_path, fs::Permissions::from_mode(mode))?;
                        }
                    }
                }
            } else {
                return Err(ExtractError::InvalidArchiveRoot {
                    expected: root_prefix.to_string(),
                    actual: entry_path.to_path_buf(),
                });
            }
        }
    } else {
        // 无需剥离顶层目录，直接解压
        for i in 0..archive.len() {
            let mut zip_file = archive.by_index(i)?;
            let entry_path = Path::new(zip_file.name());

            if is_ignored_archive_metadata(entry_path) {
                continue;
            }

            if !is_path_safe(entry_path) {
                return Err(ExtractError::PathTraversal(entry_path.to_path_buf()));
            }

            let out_path = target_dir.join(entry_path);

            if zip_file.is_dir() {
                fs::create_dir_all(&out_path)?;
            } else {
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                #[cfg(unix)]
                {
                    if let Some(mode) = zip_file.unix_mode() {
                        if (mode & 0o170000) == 0o120000 {
                            let mut symlink_target = Vec::new();
                            zip_file.read_to_end(&mut symlink_target)?;
                            let target_str = String::from_utf8(symlink_target)
                                .map_err(|_| ExtractError::InvalidSymlink(
                                    out_path.clone(),
                                    PathBuf::from("<invalid utf-8>"),
                                ))?;
                            let target_path = Path::new(&target_str);

                            if !is_symlink_safe(&out_path, target_path, target_dir) {
                                return Err(ExtractError::InvalidSymlink(out_path, target_path.to_path_buf()));
                            }

                            if out_path.exists() || fs::symlink_metadata(&out_path).is_ok() {
                                let _ = fs::remove_file(&out_path);
                            }
                            std::os::unix::fs::symlink(target_path, &out_path)?;
                            continue;
                        }
                    }
                }

                let mut outfile = File::create(&out_path)?;
                io::copy(&mut zip_file, &mut outfile)?;

                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Some(mode) = zip_file.unix_mode() {
                        fs::set_permissions(&out_path, fs::Permissions::from_mode(mode))?;
                    }
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_is_path_safe() {
        // 安全路径
        assert!(is_path_safe(Path::new("foo/bar.txt")));
        assert!(is_path_safe(Path::new("subdir/nested/file.rs")));

        // 不安全路径 (试图跳出当前目录)
        assert!(!is_path_safe(Path::new("../escaped.txt")));
        assert!(!is_path_safe(Path::new("foo/../../escaped.txt")));
    }

    #[test]
    fn test_is_symlink_safe() {
        let target_dir = Path::new("/workspace/app");

        // 符号链接文件位置: /workspace/app/bin/node
        let symlink_pos = Path::new("/workspace/app/bin/node");

        // 安全：目标指向同级或子集路径，如 `../lib/node_modules/npm/bin/npm-cli.js`
        // 展开后为 `/workspace/app/lib/node_modules/npm/bin/npm-cli.js`
        assert!(is_symlink_safe(
            symlink_pos,
            Path::new("../lib/node_modules/npm/bin/npm-cli.js"),
            target_dir
        ));

        // 不安全：指向外部目录，如 `../../etc/passwd`
        // 展开后为 `/workspace/etc/passwd`
        assert!(!is_symlink_safe(
            symlink_pos,
            Path::new("../../etc/passwd"),
            target_dir
        ));

        // 不安全：绝对路径符号链接
        assert!(!is_symlink_safe(
            symlink_pos,
            Path::new("/etc/passwd"),
            target_dir
        ));
    }

    #[test]
    fn test_extract_package_zip_success_with_unwrapping() {
        let temp_dir = std::env::temp_dir();
        let test_root = temp_dir.join("fastbox_test_extract");
        if test_root.exists() {
            let _ = fs::remove_dir_all(&test_root);
        }
        fs::create_dir_all(&test_root).unwrap();

        let zip_path = test_root.join("test_archive.zip");
        let target_install_dir = test_root.join("installed_app");

        // 1. 动态构造一个 mock 压缩包，带有根目录前缀 "node-v24.16.0"
        let zip_file = fs::File::create(&zip_path).unwrap();
        let mut zip_writer = zip::ZipWriter::new(zip_file);

        // zip::write::SimpleFileOptions was introduced in zip 2.0 (which we have)
        let options = zip::write::SimpleFileOptions::default();

        // 写入普通目录与文件
        zip_writer.start_file("node-v24.16.0/bin/node", options).unwrap();
        zip_writer.write_all(b"fake_node_binary_content").unwrap();

        zip_writer.start_file("node-v24.16.0/README.md", options).unwrap();
        zip_writer.write_all(b"README contents").unwrap();

        zip_writer.finish().unwrap();

        // 2. 执行解压并去包裹 (剥离前缀 "node-v24.16.0")
        let extract_res = extract_package(&zip_path, &target_install_dir, Some("node-v24.16.0"));
        assert!(extract_res.is_ok());

        // 3. 验证去包裹是否正确平铺到安装目录中
        let node_bin_path = target_install_dir.join("bin").join("node");
        let readme_path = target_install_dir.join("README.md");

        assert!(node_bin_path.exists());
        assert!(readme_path.exists());

        // 验证内容正确
        let node_content = fs::read_to_string(&node_bin_path).unwrap();
        assert_eq!(node_content, "fake_node_binary_content");

        // 验证解包的临时目录 .tmp 已经不存在了
        let temp_extract_dir = target_install_dir.with_extension("tmp");
        assert!(!temp_extract_dir.exists(), "临时目录应当在重命名后被移除或不再存在");

        // 清除测试目录
        let _ = fs::remove_dir_all(&test_root);
    }

    #[test]
    fn test_normalize_path_redundant_parents() {
        // 测试正常组件
        assert_eq!(normalize_path(Path::new("foo/bar")), PathBuf::from("foo/bar"));
        // 测试带有 .. 的逃逸路径在 components 为空时仍保留 ..
        assert_eq!(normalize_path(Path::new("foo/bar/../../../../etc")), PathBuf::from("../../etc"));
        assert_eq!(normalize_path(Path::new("../../../../etc")), PathBuf::from("../../../../etc"));
        // 绝对路径测试，/ 根目录下不应该有逃逸
        assert_eq!(normalize_path(Path::new("/foo/bar/../../../../etc")), PathBuf::from("/etc"));
    }

    #[test]
    fn test_is_symlink_safe_redundant_parents() {
        let target_dir = Path::new("/workspace/app");
        let symlink_pos = Path::new("/workspace/app/bin/node");

        // 试图通过多重 .. 绕过
        assert!(!is_symlink_safe(
            symlink_pos,
            Path::new("../../../../etc/passwd"),
            target_dir
        ));

        // 内部合法相对链接
        assert!(is_symlink_safe(
            symlink_pos,
            Path::new("../lib/node"),
            target_dir
        ));
    }
}
