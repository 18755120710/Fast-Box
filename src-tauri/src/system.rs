use std::path::PathBuf;

/// 获取操作系统，统一映射为小写格式
pub fn get_os() -> String {
    match std::env::consts::OS {
        "macos" => "macos".to_string(),
        "windows" => "windows".to_string(),
        other => other.to_string(),
    }
}

/// 获取 CPU 架构，将 Rust aarch64 转为通用的 arm64，x86_64 转为 x64
pub fn get_arch() -> String {
    match std::env::consts::ARCH {
        "aarch64" => "arm64".to_string(),
        "x86_64" => "x64".to_string(),
        other => other.to_string(),
    }
}

/// 定位用户 Home 目录并构建 `.fastbox` 物理路径
pub fn get_fastbox_home() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".fastbox"))
        .ok_or_else(|| "Failed to locate user home directory".to_string())
}

/// 应用启动的前置校验：初始化所需目录树
pub fn initialize_workspace() -> Result<PathBuf, String> {
    let home = get_fastbox_home()?;
    let subdirs = vec!["packages", "shims", "state", "cache", "logs", "registry"];
    for subdir in subdirs {
        let path = home.join(subdir);
        if !path.exists() {
            std::fs::create_dir_all(&path)
                .map_err(|e| format!("Failed to create directory ~/.fastbox/{}: {}", subdir, e))?;
        }
    }
    Ok(home)
}
