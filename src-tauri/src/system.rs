use std::path::PathBuf;
use serde_json;

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
    if let Ok(home) = std::env::var("FASTBOX_HOME") {
        let trimmed = home.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    let default_home = dirs::home_dir()
        .map(|h| h.join(".fastbox"))
        .ok_or_else(|| "Failed to locate user home directory".to_string())?;

    let config_path = default_home.join("config.json");
    if config_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(workspace_val) = settings.get("workspacePath").and_then(|v| v.as_str()) {
                    let home_dir_str = dirs::home_dir()
                        .map(|h| h.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let expanded = workspace_val.replace("~", &home_dir_str);
                    return Ok(PathBuf::from(expanded));
                }
            }
        }
    }

    Ok(default_home)
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
