use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use serde::Deserialize;
use tauri::Manager;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryPackage {
    pub name: String,
    pub display_name: String,
    pub versions: HashMap<String, serde_json::Value>, // 键为版本号，用于获取 availableVersions
    pub bins: Vec<BinConfig>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BinConfig {
    pub name: String,
    pub relative_path: String,
    pub windows_relative_path: Option<String>,
}

pub fn load_package_from_registry(app_handle: &tauri::AppHandle, name: &str) -> Result<RegistryPackage, String> {
    let package_path = resolve_registry_package_path(app_handle, name)?;

    let content = fs::read_to_string(&package_path)
        .map_err(|e| format!("Failed to read registry file for {} at {:?}: {}", name, package_path, e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse registry json for {}: {}", name, e))
}

fn resolve_registry_package_path(app_handle: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let package_file = format!("{}.json", name);

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_path = PathBuf::from(manifest_dir)
            .join("..")
            .join("fast-box-registry")
            .join("packages")
            .join(&package_file);
        if dev_path.exists() {
            return Ok(dev_path);
        }
    }

    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource directory: {}", e))?
        .join("fast-box-registry")
        .join("packages")
        .join(package_file);

    Ok(resource_path)
}
