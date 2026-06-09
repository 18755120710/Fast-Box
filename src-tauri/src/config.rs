use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub workspace_path: String,
    pub registry_mode: String, // "official" | "huawei" | "custom"
    pub custom_registry: String,
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        let default_workspace = dirs::home_dir()
            .map(|h| h.join(".fastbox").to_string_lossy().to_string())
            .unwrap_or_else(|| "~/.fastbox".to_string());

        Self {
            workspace_path: default_workspace,
            registry_mode: "huawei".to_string(),
            custom_registry: "https://registry.npmmirror.com".to_string(),
            language: "zh".to_string(),
        }
    }
}

pub fn get_default_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir()
        .map(|h| h.join(".fastbox"))
        .ok_or_else(|| "Failed to locate user home directory".to_string())?;
    Ok(home.join("config.json"))
}

pub fn read_settings() -> AppSettings {
    if let Ok(path) = get_default_config_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                    return settings;
                }
            }
        }
    }
    AppSettings::default()
}

pub fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_default_config_path()?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
    }
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, content)
        .map_err(|e| format!("Failed to write config.json.tmp: {}", e))?;
    fs::rename(&temp_path, &path)
        .map_err(|e| format!("Failed to rename config.json.tmp to config.json: {}", e))
}
