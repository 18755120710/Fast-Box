use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use serde::Deserialize;
use tauri::Manager;
use crate::system::get_fastbox_home;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryPackage {
    pub name: String,
    pub display_name: String,
    pub versions: HashMap<String, VersionDetail>, // 键为版本号，用于获取 availableVersions
    pub bins: Vec<BinConfig>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BinConfig {
    pub name: String,
    pub relative_path: String,
    pub windows_relative_path: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct PlatformDetail {
    pub os: String,
    pub arch: String,
    pub archive_type: String,
    pub file_name: String,
    pub official_url: String,
    pub mirror_urls: Vec<String>,
    pub sha256: String,
    pub archive_root: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VerifyConfig {
    pub command: String,
    pub expected_prefix: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct VersionDetail {
    pub version: String,
    pub channel: Option<String>,
    pub codename: Option<String>,
    pub platforms: HashMap<String, PlatformDetail>,
    pub verify: Option<Vec<VerifyConfig>>,
}

impl RegistryPackage {
    pub fn get_platform_detail(&self, version: &str, os: &str, arch: &str) -> Result<PlatformDetail, String> {
        let version_detail = self.versions.get(version)
            .ok_or_else(|| format!("Version '{}' not found in registry package '{}'", version, self.name))?;

        let platform_key = format!("{}-{}", os, arch);
        let platform_detail = version_detail.platforms.get(&platform_key)
            .ok_or_else(|| format!("Platform '{}' not supported for version '{}' of '{}'", platform_key, version, self.name))?;

        Ok(platform_detail.clone())
    }
}

pub fn load_package_from_registry(app_handle: &tauri::AppHandle, name: &str) -> Result<RegistryPackage, String> {
    let package_path = resolve_registry_package_path(app_handle, name)?;
    load_package_from_path(&package_path, name)
}

pub fn load_package_for_cli(name: &str) -> Result<RegistryPackage, String> {
    let package_path = resolve_cli_registry_package_path(name)?;
    load_package_from_path(&package_path, name)
}

fn load_package_from_path(package_path: &PathBuf, name: &str) -> Result<RegistryPackage, String> {
    let content = fs::read_to_string(&package_path)
        .map_err(|e| format!("Failed to read registry file for {} at {:?}: {}", name, package_path, e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse registry json for {}: {}", name, e))
}

fn resolve_registry_package_path(app_handle: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let package_file = format!("{}.json", name);

    if let Some(home_path) = registry_path_from_fastbox_home(&package_file)? {
        return Ok(home_path);
    }

    if let Some(dev_path) = dev_registry_package_path(&package_file) {
        return Ok(dev_path);
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

fn resolve_cli_registry_package_path(name: &str) -> Result<PathBuf, String> {
    let package_file = format!("{}.json", name);

    if let Some(home_path) = registry_path_from_fastbox_home(&package_file)? {
        return Ok(home_path);
    }

    if let Some(dev_path) = dev_registry_package_path(&package_file) {
        return Ok(dev_path);
    }

    Err(format!("Failed to resolve registry package for {}", name))
}

fn registry_path_from_fastbox_home(package_file: &str) -> Result<Option<PathBuf>, String> {
    let home = get_fastbox_home()?;
    let path = home.join("registry").join("packages").join(package_file);
    if path.exists() {
        Ok(Some(path))
    } else {
        Ok(None)
    }
}

fn dev_registry_package_path(package_file: &str) -> Option<PathBuf> {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("fast-box-registry")
        .join("packages")
        .join(package_file);
    if dev_path.exists() {
        Some(dev_path)
    } else {
        None
    }
}
