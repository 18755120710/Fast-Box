use std::fs;
use std::process::{Command, Stdio};

use crate::commands::{run_verification_step, run_system_verification_step, PackageStatus, VerifyResult};
use crate::download::download_with_retry;
use crate::extract::extract_package;
use crate::registry::{load_package_for_cli, RegistryPackage};
use crate::shims::{
    activate_version, ensure_version_installed, refresh_package_shims, resolve_active_binary,
    detect_system_node_version,
};
use crate::state::get_active_version;
use crate::system::{get_arch, get_fastbox_home, get_os, initialize_workspace};
use crate::verify::verify_file_sha256;

pub fn run_cli(args: &[String]) -> Result<i32, String> {
    initialize_workspace()?;

    let Some(command) = args.first().map(String::as_str) else {
        return Err(cli_usage());
    };

    match command {
        "info" => {
            #[derive(serde::Serialize)]
            struct CliSystemInfo {
                os: String,
                arch: String,
                fastbox_home: String,
            }

            print_json(&CliSystemInfo {
                os: get_os(),
                arch: get_arch(),
                fastbox_home: get_fastbox_home()?.to_string_lossy().to_string(),
            })?;
            Ok(0)
        }
        "list" => {
            let packages = list_packages_cli()?;
            print_json(&packages)?;
            Ok(0)
        }
        "install" => {
            let (name, version) = two_args(args, "install")?;
            let runtime = tokio::runtime::Runtime::new()
                .map_err(|e| format!("Failed to create Tokio runtime: {}", e))?;
            runtime.block_on(install_package_cli(name, version))?;
            println!(
                "{{\"status\":\"completed\",\"packageName\":\"{}\",\"version\":\"{}\"}}",
                name, version
            );
            Ok(0)
        }
        "use" => {
            let (name, version) = two_args(args, "use")?;
            let recipe = load_package_for_cli(name)?;
            activate_version(&recipe, version)?;
            Ok(0)
        }
        "verify" => {
            let (name, version) = two_args(args, "verify")?;
            let results = verify_package_cli(name, version)?;
            print_json(&results)?;
            Ok(0)
        }
        "uninstall" => {
            let (name, version) = two_args(args, "uninstall")?;
            uninstall_package_cli(name, version)?;
            Ok(0)
        }
        _ => Err(cli_usage()),
    }
}

pub fn run_shim(bin_name: &str, passthrough_args: &[String]) -> Result<i32, String> {
    initialize_workspace()?;

    let recipe = load_package_for_cli("node")?;
    let bin_path = resolve_active_binary(&recipe, bin_name)?;
    let status = Command::new(bin_path)
        .args(passthrough_args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .map_err(|e| format!("Fast Box: failed to execute shim target '{}': {}", bin_name, e))?;

    Ok(status.code().unwrap_or(1))
}

fn list_packages_cli() -> Result<Vec<PackageStatus>, String> {
    let package_names = crate::registry::list_all_package_names_for_cli()?;
    let mut statuses = Vec::new();

    let home = get_fastbox_home()?;

    for pkg_name in package_names {
        let recipe = load_package_for_cli(&pkg_name)?;
        let mut available_versions: Vec<String> = recipe.versions.keys().cloned().collect();
        available_versions.sort();

        let system_version = if pkg_name == "node" {
            detect_system_node_version()
        } else {
            None
        };

        let mut installed_versions = Vec::new();
        if system_version.is_some() {
            installed_versions.push("system".to_string());
        }

        let install_dir = home.join("packages").join(&pkg_name);
        if install_dir.exists() {
            for entry in fs::read_dir(&install_dir)
                .map_err(|e| format!("Failed to read installed versions for {}: {}", pkg_name, e))?
            {
                let entry = entry.map_err(|e| format!("Failed to read installed version entry for {}: {}", pkg_name, e))?;
                let path = entry.path();
                if path.is_dir() {
                    if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                        if dir_name.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                            installed_versions.push(dir_name.to_string());
                        }
                    }
                }
            }
        }
        installed_versions.sort();

        let status = if installed_versions.is_empty() {
            "not_installed".to_string()
        } else {
            "installed".to_string()
        };

        statuses.push(PackageStatus {
            name: recipe.name,
            display_name: recipe.display_name,
            installed_versions,
            active_version: get_active_version(&pkg_name),
            available_versions,
            status,
            system_version,
        });
    }

    Ok(statuses)
}


async fn install_package_cli(name: &str, version: &str) -> Result<(), String> {
    let recipe = load_package_for_cli(name)?;
    let platform_config = recipe.get_platform_detail(version, &get_os(), &get_arch())?;
    let home = get_fastbox_home()?;
    let cache_dir = home.join("cache");
    let archive_path = cache_dir.join(&platform_config.file_name);

    let mut urls = vec![platform_config.official_url.clone()];
    urls.extend(platform_config.mirror_urls.clone());

    let cache_valid = if archive_path.exists() {
        verify_file_sha256(&archive_path, &platform_config.sha256).is_ok()
    } else {
        false
    };

    if !cache_valid {
        download_with_retry(&urls, &archive_path, |_downloaded, _total| {}).await?;
    }

    verify_file_sha256(&archive_path, &platform_config.sha256)?;

    let install_dir = home.join("packages").join(name).join(version);
    if install_dir.exists() {
        fs::remove_dir_all(&install_dir)
            .map_err(|e| format!("Failed to clean existing install directory: {}", e))?;
    }

    extract_package(&archive_path, &install_dir, Some(&platform_config.archive_root))
        .map_err(|e| format!("Failed to extract package: {}", e))?;

    assert_verifications_pass(&recipe, version)?;
    refresh_package_shims(&recipe)?;
    Ok(())
}

fn verify_package_cli(name: &str, version: &str) -> Result<Vec<VerifyResult>, String> {
    let recipe = load_package_for_cli(name)?;
    let ref_version = if version == "system" {
        &recipe.default_version
    } else {
        ensure_version_installed(name, version)?;
        version
    };

    let version_detail = recipe
        .versions
        .get(ref_version)
        .ok_or_else(|| format!("Version '{}' not found in registry package '{}'", ref_version, name))?;

    let mut results = Vec::new();
    if let Some(verifications) = &version_detail.verify {
        for config in verifications {
            if version == "system" {
                results.push(run_system_verification_step(
                    &recipe,
                    &config.command,
                    config.expected_prefix.as_deref(),
                ));
            } else {
                let install_dir = get_fastbox_home()?.join("packages").join(name).join(version);
                results.push(run_verification_step(
                    &recipe,
                    &install_dir,
                    &config.command,
                    config.expected_prefix.as_deref(),
                ));
            }
        }
    }

    Ok(results)
}

fn assert_verifications_pass(recipe: &RegistryPackage, version: &str) -> Result<(), String> {
    let results = verify_package_cli(&recipe.name, version)?;
    for result in results {
        if !result.success {
            return Err(format!(
                "Verification '{}' failed: {}",
                result.command,
                result.error.unwrap_or(result.output)
            ));
        }
    }
    Ok(())
}

fn uninstall_package_cli(name: &str, version: &str) -> Result<(), String> {
    if version == "system" {
        return Err("Cannot uninstall system-provided package.".to_string());
    }

    if get_active_version(name).as_deref() == Some(version) {
        return Err(format!(
            "{} {} is currently active. Switch to another version before uninstalling it.",
            name, version
        ));
    }

    let version_dir = get_fastbox_home()?.join("packages").join(name).join(version);
    if version_dir.exists() {
        fs::remove_dir_all(&version_dir)
            .map_err(|e| format!("Failed to uninstall {} {}: {}", name, version, e))?;
    }

    if let Ok(recipe) = load_package_for_cli(name) {
        refresh_package_shims(&recipe)?;
    }

    Ok(())
}

fn two_args<'a>(args: &'a [String], command: &str) -> Result<(&'a str, &'a str), String> {
    if args.len() != 3 {
        return Err(format!("Usage: fast-box --cli {} <package> <version>", command));
    }

    Ok((&args[1], &args[2]))
}

fn print_json<T: serde::Serialize>(value: &T) -> Result<(), String> {
    let output = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize CLI output: {}", e))?;
    println!("{}", output);
    Ok(())
}

fn cli_usage() -> String {
    "Usage: fast-box --cli <info|list|install|use|verify|uninstall> [package] [version]"
        .to_string()
}
