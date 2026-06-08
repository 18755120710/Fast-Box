use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::system::get_fastbox_home;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ActiveState {
    pub active: HashMap<String, String>, // 例如 {"node": "24.16.0"}
}

pub fn get_active_json_path() -> Result<PathBuf, String> {
    let home = get_fastbox_home()?;
    Ok(home.join("state").join("active.json"))
}

pub fn read_active_state() -> Result<ActiveState, String> {
    let path = get_active_json_path()?;
    if !path.exists() {
        return Ok(ActiveState::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read active.json: {}", e))?;
    match serde_json::from_str::<ActiveState>(&content) {
        Ok(state) => Ok(state),
        Err(_) => {
            // Backup the corrupted file to active.json.bak
            let bak_path = path.with_extension("json.bak");
            let _ = fs::copy(&path, &bak_path);
            
            // Recreate new active.json with default state
            let default_state = ActiveState::default();
            if let Ok(new_content) = serde_json::to_string_pretty(&default_state) {
                let _ = fs::write(&path, new_content);
            }
            Ok(default_state)
        }
    }
}

pub fn write_active_state(state: &ActiveState) -> Result<(), String> {
    let path = get_active_json_path()?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create state directory: {}", e))?;
        }
    }
    let content = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize active state: {}", e))?;
    
    // Atomic write: write to temp file first, then rename
    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, content)
        .map_err(|e| format!("Failed to write active.json.tmp: {}", e))?;
    fs::rename(&temp_path, &path)
        .map_err(|e| format!("Failed to rename active.json.tmp to active.json: {}", e))
}

pub fn get_active_version(package_name: &str) -> Option<String> {
    read_active_state()
        .ok()
        .and_then(|s| s.active.get(package_name).cloned())
}
