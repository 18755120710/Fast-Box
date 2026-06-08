use std::fs;
use std::path::{Path, PathBuf};

use crate::registry::RegistryPackage;
use crate::state::{read_active_state, write_active_state};
use crate::system::{get_fastbox_home, get_os};

pub fn find_system_binary(bin_name: &str) -> Result<PathBuf, String> {
    let path_var = std::env::var("PATH").map_err(|e| format!("Failed to read PATH env: {}", e))?;
    let paths = std::env::split_paths(&path_var);
    let is_windows = get_os() == "windows";

    for path in paths {
        let path_str = path.to_string_lossy();
        if path_str.contains(".fastbox/shims") || path_str.contains(".fastbox\\shims") || path_str.contains(".fastbox") {
            continue;
        }

        if is_windows {
            let extensions = ["", ".exe", ".cmd", ".bat", ".ps1"];
            for ext in &extensions {
                let full_name = format!("{}{}", bin_name, ext);
                let candidate = path.join(&full_name);
                if candidate.exists() && candidate.is_file() {
                    return Ok(candidate);
                }
            }
        } else {
            let candidate = path.join(bin_name);
            if candidate.exists() && candidate.is_file() {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(metadata) = fs::metadata(&candidate) {
                        if metadata.permissions().mode() & 0o111 != 0 {
                            return Ok(candidate);
                        }
                    }
                }
                #[cfg(not(unix))]
                return Ok(candidate);
            }
        }
    }

    Err(format!("Fast Box: system binary '{}' not found in PATH", bin_name))
}

pub fn detect_system_node_version() -> Option<String> {
    let node_path = find_system_binary("node").ok()?;
    let output = std::process::Command::new(node_path)
        .arg("--version")
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let version = stdout.trim().trim_start_matches('v').to_string();
        if !version.is_empty() {
            return Some(version);
        }
    }
    None
}

pub fn activate_version(recipe: &RegistryPackage, version: &str) -> Result<(), String> {
    if version != "system" {
        ensure_version_installed(&recipe.name, version)?;
    }

    let mut state = read_active_state()?;
    state
        .active
        .insert(recipe.name.clone(), version.to_string());
    write_active_state(&state)?;
    refresh_package_shims(recipe)
}

pub fn refresh_package_shims(recipe: &RegistryPackage) -> Result<(), String> {
    let home = get_fastbox_home()?;
    let shims_dir = home.join("shims");
    fs::create_dir_all(&shims_dir)
        .map_err(|e| format!("Failed to create shims directory: {}", e))?;

    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to resolve current Fast Box executable: {}", e))?;

    for bin in &recipe.bins {
        write_shim(&shims_dir, &bin.name, &current_exe)?;
    }

    Ok(())
}

pub fn resolve_active_binary(recipe: &RegistryPackage, bin_name: &str) -> Result<PathBuf, String> {
    let state = read_active_state()?;
    let active_version = state
        .active
        .get(&recipe.name)
        .ok_or_else(|| format!("Fast Box: no active version set for {}", recipe.name))?;

    if active_version == "system" {
        return find_system_binary(bin_name);
    }

    let bin_config = recipe
        .bins
        .iter()
        .find(|bin| bin.name == bin_name)
        .ok_or_else(|| format!("Fast Box: unknown shim command '{}'", bin_name))?;

    let relative_path = if get_os() == "windows" {
        bin_config
            .windows_relative_path
            .as_deref()
            .unwrap_or(&bin_config.relative_path)
    } else {
        &bin_config.relative_path
    };

    let bin_path = get_fastbox_home()?
        .join("packages")
        .join(&recipe.name)
        .join(active_version)
        .join(relative_path);

    if !bin_path.exists() {
        return Err(format!(
            "Fast Box: active binary does not exist: {}",
            bin_path.display()
        ));
    }

    Ok(bin_path)
}

pub fn ensure_version_installed(name: &str, version: &str) -> Result<PathBuf, String> {
    if version == "system" {
        return Ok(PathBuf::new());
    }

    let version_dir = get_fastbox_home()?
        .join("packages")
        .join(name)
        .join(version);

    if !version_dir.exists() || !version_dir.is_dir() {
        return Err(format!("{} {} is not installed", name, version));
    }

    Ok(version_dir)
}

fn write_shim(shims_dir: &Path, bin_name: &str, fastbox_exe: &Path) -> Result<(), String> {
    if get_os() == "windows" {
        let shim_path = shims_dir.join(format!("{}.cmd", bin_name));
        let content = format!(
            "@echo off\r\n\"{}\" --shim {} %*\r\n",
            fastbox_exe.display(),
            bin_name
        );
        fs::write(&shim_path, content)
            .map_err(|e| format!("Failed to write Windows shim {}: {}", shim_path.display(), e))?;
    } else {
        let shim_path = shims_dir.join(bin_name);
        let content = format!(
            "#!/bin/sh\nexec \"{}\" --shim {} \"$@\"\n",
            fastbox_exe.display(),
            bin_name
        );
        fs::write(&shim_path, content)
            .map_err(|e| format!("Failed to write shim {}: {}", shim_path.display(), e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&shim_path)
                .map_err(|e| format!("Failed to read shim metadata {}: {}", shim_path.display(), e))?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&shim_path, perms)
                .map_err(|e| format!("Failed to set shim executable bit {}: {}", shim_path.display(), e))?;
        }
    }

    Ok(())
}
