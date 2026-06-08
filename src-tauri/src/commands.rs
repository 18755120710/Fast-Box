use std::fs;
use serde::{Deserialize, Serialize};
use crate::system::{get_os, get_arch, get_fastbox_home};
use crate::state::get_active_version;
use crate::registry::load_package_from_registry;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub fastbox_home: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageStatus {
    pub name: String,
    pub display_name: String,
    pub installed_versions: Vec<String>,
    pub active_version: Option<String>,
    pub available_versions: Vec<String>,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    pub command: String,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let home_path = get_fastbox_home()?;
    Ok(SystemInfo {
        os: get_os(),
        arch: get_arch(),
        fastbox_home: home_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn list_packages(app_handle: tauri::AppHandle) -> Result<Vec<PackageStatus>, String> {
    // 1. 读取包定义 (MVP 主要关注 node.json)
    let node_recipe = load_package_from_registry(&app_handle, "node")?;
    
    // 2. 从配方中提取可用版本
    let mut available_versions: Vec<String> = node_recipe.versions.keys().cloned().collect();
    available_versions.sort(); // 按照版本排序
    
    // 3. 扫描本地 ~/.fastbox/packages/node/ 目录获取已安装的版本
    let home = get_fastbox_home()?;
    let node_install_dir = home.join("packages").join("node");
    
    let mut installed_versions = Vec::new();
    if node_install_dir.exists() && node_install_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(node_install_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                        // 过滤规则：首字母为数字代表版本目录
                        if dir_name.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                            installed_versions.push(dir_name.to_string());
                        }
                    }
                }
            }
        }
    }
    installed_versions.sort();

    // 4. 获取当前激活的版本
    let active_version = get_active_version("node");

    // 5. 确定当前包状态
    let status = if installed_versions.is_empty() {
        "not_installed".to_string()
    } else {
        "installed".to_string()
    };

    // 6. 拼装结构体
    let node_status = PackageStatus {
        name: node_recipe.name,
        display_name: node_recipe.display_name,
        installed_versions,
        active_version,
        available_versions,
        status,
    };

    Ok(vec![node_status])
}

#[tauri::command]
pub async fn install_package_version(name: String, version: String) -> Result<String, String> {
    // Stub implementation for M1 Setup
    Ok(format!("task_{}_{}", name, version))
}

#[tauri::command]
pub async fn use_package_version(name: String, version: String) -> Result<(), String> {
    // Stub implementation: update active.json
    let mut state = crate::state::read_active_state()?;
    state.active.insert(name, version);
    crate::state::write_active_state(&state)?;
    Ok(())
}

#[tauri::command]
pub async fn uninstall_package_version(name: String, version: String) -> Result<(), String> {
    // Stub implementation: remove version from active if active, and delete directory
    let mut state = crate::state::read_active_state()?;
    if let Some(active) = state.active.get(&name) {
        if active == &version {
            state.active.remove(&name);
            crate::state::write_active_state(&state)?;
        }
    }
    let home = get_fastbox_home()?;
    let version_dir = home.join("packages").join(&name).join(&version);
    if version_dir.exists() {
        fs::remove_dir_all(version_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn verify_package_version(_name: String, version: String) -> Result<Vec<VerifyResult>, String> {
    // Stub implementation
    Ok(vec![
        VerifyResult {
            command: "node --version".to_string(),
            success: true,
            output: format!("v{}", version),
            error: None,
        },
        VerifyResult {
            command: "npm --version".to_string(),
            success: true,
            output: "10.0.0".to_string(),
            error: None,
        }
    ])
}

#[tauri::command]
pub async fn get_task_logs(task_id: String) -> Result<Vec<String>, String> {
    // Stub implementation
    Ok(vec![
        format!("Log message for task {}", task_id),
        "Initialization complete".to_string(),
        "Downloading package node v24.16.0...".to_string(),
        "Download finished successfully".to_string(),
        "Extracting archive...".to_string(),
        "Extraction finished successfully".to_string(),
        "Updating symlinks in shim layer...".to_string(),
        "Shim generation succeeded".to_string(),
        "Verification: node --version: v24.16.0 (PASS)".to_string(),
        "Install task completed successfully".to_string(),
    ])
}
