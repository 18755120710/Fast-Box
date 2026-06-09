use std::fs;
use std::path::Path;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

use crate::system::{get_os, get_arch, get_fastbox_home};
use crate::state::get_active_version;
use crate::registry::load_package_from_registry;
use crate::download::download_with_retry;
use crate::extract::extract_package;
use crate::verify::verify_file_sha256;
use crate::shims::{activate_version, refresh_package_shims, detect_system_node_version};

// ==========================================
// 数据结构定义
// ==========================================

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
    pub system_version: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    pub command: String,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    Pending,
    Downloading,
    Extracting,
    Verifying,
    Completed,
    Failed,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskInfo {
    pub task_id: String,
    pub name: String,
    pub version: String,
    pub status: TaskStatus,
    pub progress: u64, // 0 到 100 之间的百分比
    pub logs: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    task_id: String,
    stage: String,
    message: String,
    status: String,
    progress: u64,
    downloaded: u64,
    total: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LogPayload {
    task_id: String,
    message: String,
}

// ==========================================
// 任务状态管理器 (内存暂存与线程安全)
// ==========================================

#[derive(Clone)]
pub struct TaskManager {
    pub tasks: Arc<Mutex<HashMap<String, TaskInfo>>>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 初始化一个新任务
    pub fn start_task(&self, task_id: String, name: String, version: String) {
        let mut tasks = self.tasks.lock().unwrap();
        tasks.insert(
            task_id.clone(),
            TaskInfo {
                task_id,
                name,
                version,
                status: TaskStatus::Pending,
                progress: 0,
                logs: vec!["[SYSTEM] 任务初始化成功".to_string()],
            },
        );
    }

    /// 更新任务状态及进度百分比
    pub fn update_status(&self, task_id: &str, status: TaskStatus, progress: u64) {
        let mut tasks = self.tasks.lock().unwrap();
        if let Some(task) = tasks.get_mut(task_id) {
            task.status = status;
            task.progress = progress;
        }
    }

    /// 往任务中追加一条日志信息并同时写入文件及发送 IPC 事件
    pub fn add_log(&self, app_handle: &tauri::AppHandle, task_id: &str, log_msg: String) {
        let (full_log, name, version) = {
            let mut tasks = self.tasks.lock().unwrap();
            if let Some(task) = tasks.get_mut(task_id) {
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                    .map(|d| {
                        let secs = d.as_secs();
                        let hour = (secs / 3600 + 8) % 24; // 简易北京时间
                        let min = (secs / 60) % 60;
                        let sec = secs % 60;
                        format!("{:02}:{:02}:{:02}", hour, min, sec)
                    })
                    .unwrap_or_else(|_| "??:??:??".to_string());

                let full_log = format!("[{}] {}", timestamp, log_msg);
                println!("Task {}: {}", task_id, full_log); // 同步输出到控制台
                task.logs.push(full_log.clone());
                (full_log, task.name.clone(), task.version.clone())
            } else {
                return;
            }
        };

        // 发送实时日志事件 (在锁外面)
        let log_payload = LogPayload {
            task_id: task_id.to_string(),
            message: full_log.clone(),
        };
        let _ = app_handle.emit("install-log", log_payload);

        // 写入本地日志文件 (在锁外面)
        if let Ok(home) = get_fastbox_home() {
            let log_file_name = format!("install-{}-{}.log", name, version);
            let log_path = home.join("logs").join(log_file_name);
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .append(true)
                .open(&log_path)
            {
                use std::io::Write;
                let _ = writeln!(file, "{}", full_log);
            }
        }
    }

    /// 获取任务日志
    pub fn get_logs(&self, task_id: &str) -> Option<Vec<String>> {
        let tasks = self.tasks.lock().unwrap();
        tasks.get(task_id).map(|task| task.logs.clone())
    }

    /// 检查是否已有针对相同 name 和 version 的任务正处于活跃状态
    pub fn is_task_active(&self, name: &str, version: &str) -> bool {
        let tasks = self.tasks.lock().unwrap();
        tasks.values().any(|t| {
            t.name == name
                && t.version == version
                && (t.status == TaskStatus::Pending
                    || t.status == TaskStatus::Downloading
                    || t.status == TaskStatus::Verifying
                    || t.status == TaskStatus::Extracting)
        })
    }
}

// ==========================================
// Tauri Commands 实现
// ==========================================

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
    let package_names = crate::registry::list_all_package_names(&app_handle)?;
    let mut statuses = Vec::new();

    let home = get_fastbox_home()?;

    for pkg_name in package_names {
        let recipe = load_package_from_registry(&app_handle, &pkg_name)?;
        let mut available_versions: Vec<String> = recipe.versions.keys().cloned().collect();
        available_versions.sort();

        let install_dir = home.join("packages").join(&pkg_name);

        let system_version = if pkg_name == "node" {
            detect_system_node_version()
        } else {
            None
        };

        let mut installed_versions = Vec::new();
        if system_version.is_some() {
            installed_versions.push("system".to_string());
        }

        if install_dir.exists() && install_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(install_dir) {
                for entry in entries.flatten() {
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
        }
        installed_versions.sort();

        let active_version = get_active_version(&pkg_name);
        let status = if installed_versions.is_empty() {
            "not_installed".to_string()
        } else {
            "installed".to_string()
        };

        statuses.push(PackageStatus {
            name: recipe.name,
            display_name: recipe.display_name,
            installed_versions,
            active_version,
            available_versions,
            status,
            system_version,
        });
    }

    Ok(statuses)
}


#[tauri::command]
pub async fn install_package_version(
    app_handle: tauri::AppHandle,
    task_manager: tauri::State<'_, TaskManager>,
    name: String,
    version: String,
) -> Result<String, String> {
    // 检查是否已有针对相同 name 和 version 的任务正处于活跃状态
    if task_manager.is_task_active(&name, &version) {
        return Err("该包版本正在安装中...".to_string());
    }

    // 生成唯一任务 ID: task_node_24.16.0_<timestamp>
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let task_id = format!("task_{}_{}_{}", name, version, timestamp);

    // 在状态管理器中注册任务
    task_manager.start_task(task_id.clone(), name.clone(), version.clone());

    // 启动后台 Tokio 任务执行下载与安装
    let task_id_clone = task_id.clone();
    let app_handle_clone = app_handle.clone();

    tokio::spawn(async move {
        let task_manager = app_handle_clone.state::<TaskManager>();
        if let Err(e) = run_install_pipeline(app_handle_clone.clone(), &task_id_clone, &name, &version).await {
            task_manager.add_log(&app_handle_clone, &task_id_clone, format!("[ERROR] 安装失败: {}", e));
            task_manager.update_status(&task_id_clone, TaskStatus::Failed, 0);

            // 发送安装失败事件
            let progress_payload = ProgressPayload {
                task_id: task_id_clone.clone(),
                stage: "failed".to_string(),
                message: e.to_string(),
                status: "failed".to_string(),
                progress: 0,
                downloaded: 0,
                total: 0,
            };
            let _ = app_handle_clone.emit("install-progress", progress_payload);
        }
    });

    Ok(task_id)
}

#[tauri::command]
pub async fn use_package_version(
    app_handle: tauri::AppHandle,
    name: String,
    version: String,
) -> Result<(), String> {
    let recipe = load_package_from_registry(&app_handle, &name)?;
    activate_version(&recipe, &version)
}

#[tauri::command]
pub async fn uninstall_package_version(
    app_handle: tauri::AppHandle,
    name: String,
    version: String,
) -> Result<String, String> {
    if version == "system" {
        return Err("Cannot uninstall system-provided package.".to_string());
    }

    let mut state = crate::state::read_active_state()?;
    let is_active = state.active.get(&name).map_or(false, |v| v == &version);
    let transition_message: String;

    if is_active {
        // Find other installed versions
        let home = get_fastbox_home()?;
        let install_dir = home.join("packages").join(&name);
        let mut installed = Vec::new();
        
        // Check if system node exists
        if name == "node" && crate::shims::detect_system_node_version().is_some() {
            installed.push("system".to_string());
        }

        if install_dir.exists() && install_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(&install_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                            if dir_name != version && dir_name.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                                installed.push(dir_name.to_string());
                            }
                        }
                    }
                }
            }
        }

        if !installed.is_empty() {
            installed.sort();
            let fallback = &installed[0]; // e.g. system
            
            // Auto switch active version to fallback
            let recipe = crate::registry::load_package_from_registry(&app_handle, &name)?;
            crate::shims::activate_version(&recipe, fallback)?;
            transition_message = format!("已卸载当前激活的版本 v{}，已自动为您重定向切换至 v{} 版本以保证开发环境可用。", version, fallback);
        } else {
            // Clear active version since no versions left
            state.active.remove(&name);
            crate::state::write_active_state(&state)?;
            
            // Delete/refresh shims
            if let Ok(recipe) = crate::registry::load_package_from_registry(&app_handle, &name) {
                let shims_dir = home.join("shims");
                for bin in &recipe.bins {
                    let shim_path = if get_os() == "windows" {
                        shims_dir.join(format!("{}.cmd", bin.name))
                    } else {
                        shims_dir.join(&bin.name)
                    };
                    if shim_path.exists() {
                        let _ = fs::remove_file(shim_path);
                    }
                }
            }
            transition_message = format!("已卸载当前激活的版本 v{}，目前已无其它可用版本，对应的全局 Shim 代理命令已自动清理。", version);
        }
    } else {
        transition_message = format!("成功卸载包 {} 的 v{} 版本。", name, version);
    }

    let home = get_fastbox_home()?;
    let version_dir = home.join("packages").join(&name).join(&version);
    if version_dir.exists() {
        tokio::task::spawn_blocking(move || {
            fs::remove_dir_all(version_dir)
        })
        .await
        .map_err(|e| format!("Uninstall thread panicked: {}", e))?
        .map_err(|e| e.to_string())?;
    }

    Ok(transition_message)
}


#[tauri::command]
pub async fn verify_package_version(
    app_handle: tauri::AppHandle,
    name: String,
    version: String,
) -> Result<Vec<VerifyResult>, String> {
    let recipe = load_package_from_registry(&app_handle, &name)?;
    let home = get_fastbox_home()?;

    let ref_version = if version == "system" {
        &recipe.default_version
    } else {
        &version
    };

    let version_val = recipe.versions.get(ref_version)
        .ok_or_else(|| format!("未在注册表中找到版本 {}", ref_version))?;

    let mut results = Vec::new();
    if let Some(verifications) = &version_val.verify {
        for config in verifications {
            let res = if version == "system" {
                run_system_verification_step(&recipe, &config.command, config.expected_prefix.as_deref())
            } else {
                let install_path = home.join("packages").join(&name).join(&version);
                if !install_path.exists() {
                    return Err(format!("版本 {} 未安装", version));
                }
                run_verification_step(&recipe, &install_path, &config.command, config.expected_prefix.as_deref())
            };
            results.push(res);
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_task_logs(
    task_id: String,
    task_manager: tauri::State<'_, TaskManager>,
) -> Result<Vec<String>, String> {
    task_manager
        .get_logs(&task_id)
        .ok_or_else(|| format!("未找到任务 ID 为 {} 的任务日志", task_id))
}

// ==========================================
// 辅助逻辑函数
// ==========================================

/// 执行安装全流程：下载、校验、解压、移动、后置测试
async fn run_install_pipeline(
    app_handle: tauri::AppHandle,
    task_id: &str,
    name: &str,
    version: &str,
) -> Result<(), String> {
    let task_manager = app_handle.state::<TaskManager>();

    // 1. 读取注册表配方并匹配当前平台
    task_manager.add_log(&app_handle, task_id, "正在读取软件包注册表信息...".to_string());
    let recipe = load_package_from_registry(&app_handle, name)?;

    let platform_config = recipe.get_platform_detail(version, &get_os(), &get_arch())?;

    let home = get_fastbox_home()?;
    let cache_dir = home.join("cache");
    let dest_path = cache_dir.join(&platform_config.file_name);

    // 收集所有候选 URL 列表 (官方链接 + 备选镜像链接)
    let mut urls = vec![platform_config.official_url.clone()];
    urls.extend(platform_config.mirror_urls.clone());

    // 2. 检查本地缓存并验证以进行缓存复用
    let mut need_download = true;
    if dest_path.exists() {
        task_manager.add_log(&app_handle, task_id, "检测到本地已存在同名缓存，正在进行 SHA256 完整性校验以复用缓存...".to_string());

        let dest_path_clone = dest_path.clone();
        let sha_expected = platform_config.sha256.clone();
        let verify_cache_res = tokio::task::spawn_blocking(move || {
            verify_file_sha256(&dest_path_clone, &sha_expected)
        })
        .await
        .map_err(|e| format!("Verify thread panicked: {}", e))?;

        match verify_cache_res {
            Ok(_) => {
                task_manager.add_log(&app_handle, task_id, "本地缓存校验通过，跳过下载阶段直接解包！".to_string());
                need_download = false;
            }
            Err(_) => {
                task_manager.add_log(&app_handle, task_id, "检测到本地残留同名损坏缓存，已自动清理损坏的缓存文件。".to_string());
                // Note: verify_file_sha256 has already removed the file on failure
            }
        }
    }

    // 3. 执行下载流程
    if need_download {
        task_manager.update_status(task_id, TaskStatus::Downloading, 0);
        task_manager.add_log(&app_handle, task_id, format!("开始下载软件包，候选 URL 共 {} 个", urls.len()));

        let task_id_str = task_id.to_string();
        let app_handle_cb = app_handle.clone();
        let task_manager_cb = task_manager.inner().clone();

        let progress_cb = move |downloaded: u64, total: u64| {
            let percent = if total == 0 {
                0
            } else {
                ((downloaded as f64 / total as f64) * 100.0) as u64
            };
            task_manager_cb.update_status(&task_id_str, TaskStatus::Downloading, percent);

            let payload = ProgressPayload {
                task_id: task_id_str.clone(),
                stage: "downloading".to_string(),
                message: format!("Downloaded {} of {} bytes", downloaded, total),
                status: "downloading".to_string(),
                progress: percent,
                downloaded,
                total,
            };
            let _ = app_handle_cb.emit("install-progress", payload);
        };

        download_with_retry(&urls, &dest_path, progress_cb).await?;
        task_manager.add_log(&app_handle, task_id, "软件包下载成功。".to_string());
    }

    // 4. 进入哈希校验阶段 [Verifying]
    task_manager.update_status(task_id, TaskStatus::Verifying, 90);
    task_manager.add_log(&app_handle, task_id, "正在进行 SHA256 完整性校验...".to_string());

    let dest_path_clone = dest_path.clone();
    let sha_expected = platform_config.sha256.clone();
    tokio::task::spawn_blocking(move || {
        verify_file_sha256(&dest_path_clone, &sha_expected)
    })
    .await
    .map_err(|e| format!("Verify thread panicked: {}", e))??;

    task_manager.add_log(&app_handle, task_id, "SHA256 完整性校验通过。".to_string());

    // 5. 执行解压阶段 [Extracting]
    task_manager.update_status(task_id, TaskStatus::Extracting, 92);
    task_manager.add_log(&app_handle, task_id, "正在解压缩并且平铺至安装目录...".to_string());

    let install_dir = home.join("packages").join(name).join(version);
    if install_dir.exists() {
        task_manager.add_log(&app_handle, task_id, "发现已存在的同版本安装目录，正在清理旧目录...".to_string());
        let install_dir_clone = install_dir.clone();
        tokio::task::spawn_blocking(move || {
            fs::remove_dir_all(&install_dir_clone)
        })
        .await
        .map_err(|e| format!("清理旧安装目录线程 panic: {}", e))?
        .map_err(|e| format!("清理旧安装目录失败: {}", e))?;
    }

    let dest_path_clone = dest_path.clone();
    let install_dir_clone = install_dir.clone();
    let archive_root_clone = platform_config.archive_root.clone();

    let extract_res = tokio::task::spawn_blocking(move || {
        extract_package(&dest_path_clone, &install_dir_clone, Some(&archive_root_clone))
    })
    .await
    .map_err(|e| format!("Extract thread panicked: {}", e))?;

    match extract_res {
        Ok(_) => {
            task_manager.add_log(&app_handle, task_id, format!("软件包解压成功，已平铺安装至: {:?}", install_dir));
        }
        Err(e) => {
            return Err(format!("文件解压安装失败: {}", e));
        }
    }

    // 6. 后置命令环境校验 [Verifying]
    task_manager.update_status(task_id, TaskStatus::Verifying, 95);
    task_manager.add_log(&app_handle, task_id, "开始执行后置环境校验...".to_string());

    let version_detail = recipe.versions.get(version)
        .ok_or_else(|| format!("未在配方中找到版本: {}", version))?;

    if let Some(verifications) = &version_detail.verify {
        for config in verifications {
            task_manager.add_log(&app_handle, task_id, format!("运行校验命令: {}", config.command));

            let recipe_clone = recipe.clone();
            let install_dir_clone = install_dir.clone();
            let command_clone = config.command.clone();
            let expected_prefix_clone = config.expected_prefix.clone();

            let v_res = tokio::task::spawn_blocking(move || {
                run_verification_step(&recipe_clone, &install_dir_clone, &command_clone, expected_prefix_clone.as_deref())
            })
            .await
            .map_err(|e| format!("Verification thread panicked: {}", e))?;

            if v_res.success {
                task_manager.add_log(&app_handle, task_id, format!("[PASS] -> 输出: {}", v_res.output));
            } else {
                let err_msg = v_res.error.unwrap_or_else(|| "未知执行错误".to_string());
                return Err(format!("后置命令 '{}' 校验失败: {}", config.command, err_msg));
            }
        }
    }

    // 7. 创建 Shims。安装不会自动激活版本，切换由 use_package_version 完成。
    task_manager.add_log(&app_handle, task_id, "正在创建 Shims 代理文件...".to_string());
    refresh_package_shims(&recipe)?;
    task_manager.add_log(&app_handle, task_id, "Shims 代理文件创建完成。".to_string());

    // 8. 任务完成
    task_manager.add_log(&app_handle, task_id, "[SYSTEM] 安装全流程校验通过，任务完成！".to_string());
    task_manager.update_status(task_id, TaskStatus::Completed, 100);

    // 触发 Tauri 前端安装状态更新事件通知
    let completion_payload = ProgressPayload {
        task_id: task_id.to_string(),
        stage: "completed".to_string(),
        message: "Install completed".to_string(),
        status: "completed".to_string(),
        progress: 100,
        downloaded: 0,
        total: 0,
    };
    let _ = app_handle.emit("install-progress", completion_payload);

    Ok(())
}

/// 校验命令运行的具体实现
pub(crate) fn run_verification_step(
    recipe: &crate::registry::RegistryPackage,
    install_path: &Path,
    cmd_str: &str,
    expected_prefix: Option<&str>,
) -> VerifyResult {
    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
    if parts.is_empty() {
        return VerifyResult {
            command: cmd_str.to_string(),
            success: false,
            output: "".to_string(),
            error: Some("空校验命令".to_string()),
        };
    }

    let bin_key = parts[0];
    let args = &parts[1..];

    let bin_config = recipe.bins.iter().find(|b| b.name == bin_key);
    let relative_path = match bin_config {
        Some(config) => {
            if get_os() == "windows" {
                config.windows_relative_path.as_deref().unwrap_or(&config.relative_path)
            } else {
                &config.relative_path
            }
        }
        None => {
            return VerifyResult {
                command: cmd_str.to_string(),
                success: false,
                output: "".to_string(),
                error: Some(format!("未在 bins 中找到名称为 '{}' 的二进制定义", bin_key)),
            };
        }
    };

    let bin_path = install_path.join(relative_path);
    if !bin_path.exists() {
        return VerifyResult {
            command: cmd_str.to_string(),
            success: false,
            output: "".to_string(),
            error: Some(format!("未在路径找到二进制文件: {:?}", bin_path)),
        };
    }

    // Unix 平台，赋予可执行权限
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(&bin_path) {
            let mut perms = metadata.permissions();
            if perms.mode() & 0o111 == 0 {
                perms.set_mode(perms.mode() | 0o111);
                let _ = fs::set_permissions(&bin_path, perms);
            }
        }
    }

    let mut command = std::process::Command::new(&bin_path);
    command.args(args);

    match command.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            if !output.status.success() {
                return VerifyResult {
                    command: cmd_str.to_string(),
                    success: false,
                    output: stdout,
                    error: Some(format!("退出状态码: {:?}. 错误输出: {}", output.status.code(), stderr)),
                };
            }

            if let Some(prefix) = expected_prefix {
                if !stdout.starts_with(prefix) {
                    return VerifyResult {
                        command: cmd_str.to_string(),
                        success: false,
                        output: stdout.clone(),
                        error: Some(format!(
                            "预期输出前缀为 '{}', 但实际得到: '{}'",
                            prefix, stdout
                        )),
                    };
                }
            }

            VerifyResult {
                command: cmd_str.to_string(),
                success: true,
                output: stdout,
                error: None,
            }
        }
        Err(e) => VerifyResult {
            command: cmd_str.to_string(),
            success: false,
            output: "".to_string(),
            error: Some(format!("执行校验进程失败: {}", e)),
        },
    }
}

pub(crate) fn run_system_verification_step(
    _recipe: &crate::registry::RegistryPackage,
    cmd_str: &str,
    expected_prefix: Option<&str>,
) -> VerifyResult {
    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
    if parts.is_empty() {
        return VerifyResult {
            command: cmd_str.to_string(),
            success: false,
            output: "".to_string(),
            error: Some("空校验命令".to_string()),
        };
    }

    let bin_key = parts[0];
    let args = &parts[1..];

    let dynamic_prefix = if bin_key == "node" && expected_prefix.is_some() {
        crate::shims::detect_system_node_version().map(|sys_ver| format!("v{}", sys_ver))
    } else {
        None
    };

    let actual_expected_prefix = if let Some(ref dp) = dynamic_prefix {
        Some(dp.as_str())
    } else {
        expected_prefix
    };

    // 查找系统自带的二进制文件
    let bin_path = match crate::shims::find_system_binary(bin_key) {
        Ok(path) => path,
        Err(e) => {
            return VerifyResult {
                command: cmd_str.to_string(),
                success: false,
                output: "".to_string(),
                error: Some(e),
            };
        }
    };

    let mut command = std::process::Command::new(&bin_path);
    command.args(args);

    match command.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            if !output.status.success() {
                return VerifyResult {
                    command: cmd_str.to_string(),
                    success: false,
                    output: stdout,
                    error: Some(format!("退出状态码: {:?}. 错误输出: {}", output.status.code(), stderr)),
                };
            }

            if let Some(prefix) = actual_expected_prefix {
                if !stdout.starts_with(prefix) {
                    return VerifyResult {
                        command: cmd_str.to_string(),
                        success: false,
                        output: stdout.clone(),
                        error: Some(format!(
                            "预期输出前缀为 '{}', 但实际得到: '{}'",
                            prefix, stdout
                        )),
                    };
                }
            }

            VerifyResult {
                command: cmd_str.to_string(),
                success: true,
                output: stdout,
                error: None,
            }
        }
        Err(e) => VerifyResult {
            command: cmd_str.to_string(),
            success: false,
            output: "".to_string(),
            error: Some(format!("执行校验进程失败: {}", e)),
        },
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityItem {
    pub title: String,
    pub description: String,
    pub time_ago: String,
    pub status: String, // "success" | "failed" | "running"
}

#[tauri::command]
pub async fn get_recent_activities() -> Result<Vec<ActivityItem>, String> {
    let home = get_fastbox_home()?;
    let logs_dir = home.join("logs");
    if !logs_dir.exists() || !logs_dir.is_dir() {
        return Ok(vec![]);
    }

    let mut items = Vec::new();
    if let Ok(entries) = fs::read_dir(logs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "log") {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.starts_with("install-") {
                        let name_part = &file_name["install-".len()..];
                        let parts: Vec<&str> = name_part.split('-').collect();
                        if parts.len() >= 2 {
                            let pkg_name = parts[0];
                            let version_ext = parts[1];
                            let version = version_ext.trim_end_matches(".log");

                            let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
                            let modified = metadata.modified().map_err(|e| e.to_string())?;
                            let duration = std::time::SystemTime::now()
                                .duration_since(modified)
                                .unwrap_or_else(|_| std::time::Duration::from_secs(0));
                            
                            let mins = duration.as_secs() / 60;
                            let time_ago = if mins < 1 {
                                "刚刚".to_string()
                            } else if mins < 60 {
                                format!("{} 分钟前", mins)
                            } else if mins < 1440 {
                                format!("{} 小时前", mins / 60)
                            } else {
                                format!("{} 天前", mins / 1440)
                            };

                            let mut status = if let Ok(content) = fs::read_to_string(&path) {
                                if content.contains("[SYSTEM] 安装全流程校验通过") || content.contains("completed") {
                                    "success".to_string()
                                } else if content.contains("[ERROR]") || content.contains("failed") {
                                    "failed".to_string()
                                } else {
                                    "running".to_string()
                                }
                            } else {
                                "success".to_string()
                            };

                            let is_interrupted = status == "running" && duration.as_secs() > 120;
                            if is_interrupted {
                                status = "failed".to_string();
                            }

                            let title = format!("安装 {} v{}", pkg_name, version);
                            let description = if status == "success" {
                                format!("软件包 {} v{} 下载、校验并解压安装成功", pkg_name, version)
                            } else if status == "failed" {
                                if is_interrupted {
                                    format!("软件包 {} v{} 安装已被中断（可能重启了程序）", pkg_name, version)
                                } else {
                                    format!("软件包 {} v{} 安装失败，详情请查看日志文件", pkg_name, version)
                                }
                            } else {
                                format!("正在执行 {} v{} 的安装流程", pkg_name, version)
                            };

                            items.push((modified, ActivityItem {
                                title,
                                description,
                                time_ago,
                                status,
                            }));
                        }
                    }
                }
            }
        }
    }

    items.sort_by(|a, b| b.0.cmp(&a.0));
    let result: Vec<ActivityItem> = items.into_iter().map(|(_, item)| item).take(5).collect();
    Ok(result)
}

#[tauri::command]
pub async fn check_path_status() -> Result<bool, String> {
    let path_var = match std::env::var("PATH") {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };

    let home = get_fastbox_home()?;
    let shims_dir = home.join("shims");
    let shims_dir_str = shims_dir.to_string_lossy().to_string();

    let paths = std::env::split_paths(&path_var);
    for path in paths {
        let path_str = path.to_string_lossy().to_string();
        if path_str == shims_dir_str {
            return Ok(true);
        }
        if path_str.contains(".fastbox/shims") || path_str.contains(".fastbox\\shims") {
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn get_settings() -> Result<crate::config::AppSettings, String> {
    Ok(crate::config::read_settings())
}

fn expand_path(p: &str) -> PathBuf {
    let home_dir_str = dirs::home_dir()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_default();
    let expanded = p.replace("~", &home_dir_str);
    PathBuf::from(expanded)
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> Result<(), String> {
    fs::create_dir_all(&dst).map_err(|e| format!("创建目标目录失败: {}", e))?;
    for entry in fs::read_dir(src).map_err(|e| format!("读取源目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录条目失败: {}", e))?;
        let ty = entry.file_type().map_err(|e| format!("获取文件类型失败: {}", e))?;
        let dest_path = dst.as_ref().join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(entry.path(), dest_path)?;
        } else {
            fs::copy(entry.path(), dest_path).map_err(|e| format!("复制文件失败: {}", e))?;
        }
    }
    Ok(())
}

fn migrate_workspace(old_dir: &Path, new_dir: &Path) -> Result<(), String> {
    if old_dir == new_dir {
        return Ok(());
    }
    if !old_dir.exists() {
        return Ok(());
    }
    if let Some(parent) = new_dir.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建工作空间父目录: {}", e))?;
        }
    }
    let subdirs = vec!["packages", "shims", "state", "cache", "logs", "registry"];
    for subdir in subdirs {
        let src = old_dir.join(subdir);
        let dst = new_dir.join(subdir);
        if src.exists() {
            if dst.exists() {
                let _ = fs::remove_dir_all(&dst);
            }
            if let Err(_) = fs::rename(&src, &dst) {
                copy_dir_all(&src, &dst)?;
                let _ = fs::remove_dir_all(&src);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn save_settings(settings: crate::config::AppSettings) -> Result<(), String> {
    let old_settings = crate::config::read_settings();
    let old_path = expand_path(&old_settings.workspace_path);
    let new_path = expand_path(&settings.workspace_path);

    if old_path.exists() && old_path != new_path {
        migrate_workspace(&old_path, &new_path)?;
    }

    crate::config::write_settings(&settings)?;
    let _ = crate::system::initialize_workspace();
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsage {
    pub packages_size: u64,
    pub cache_size: u64,
    pub logs_size: u64,
    pub total_size: u64,
}

fn get_dir_size<P: AsRef<Path>>(path: P) -> u64 {
    let mut size = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Ok(metadata) = fs::metadata(&p) {
                    size += metadata.len();
                }
            } else if p.is_dir() {
                size += get_dir_size(&p);
            }
        }
    }
    size
}

#[tauri::command]
pub async fn get_storage_usage() -> Result<StorageUsage, String> {
    let home = get_fastbox_home()?;
    let packages_size = get_dir_size(home.join("packages"));
    let cache_size = get_dir_size(home.join("cache"));
    let logs_size = get_dir_size(home.join("logs"));
    let total_size = packages_size + cache_size + logs_size;

    Ok(StorageUsage {
        packages_size,
        cache_size,
        logs_size,
        total_size,
    })
}

#[tauri::command]
pub async fn clean_cache() -> Result<u64, String> {
    let home = get_fastbox_home()?;
    let cache_dir = home.join("cache");
    let size_removed = get_dir_size(&cache_dir);
    if cache_dir.exists() {
        let _ = fs::remove_dir_all(&cache_dir);
        let _ = fs::create_dir_all(&cache_dir); // 重建缓存空目录
    }
    Ok(size_removed)
}

#[tauri::command]
pub async fn clean_logs() -> Result<u64, String> {
    let home = get_fastbox_home()?;
    let logs_dir = home.join("logs");
    let mut size_removed = 0;
    if logs_dir.exists() && logs_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&logs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if file_name.starts_with("install-") {
                            if let Ok(meta) = fs::metadata(&path) {
                                size_removed += meta.len();
                            }
                            let _ = fs::remove_file(path);
                        }
                    }
                }
            }
        }
    }
    Ok(size_removed)
}

#[tauri::command]
pub async fn auto_configure_path() -> Result<String, String> {
    let home = get_fastbox_home()?;
    let shims_dir = home.join("shims");
    let shims_dir_str = shims_dir.to_string_lossy().to_string();

    let shell_var = std::env::var("SHELL").unwrap_or_default();
    let config_file = if shell_var.contains("zsh") {
        dirs::home_dir().map(|h| h.join(".zshrc"))
    } else if shell_var.contains("bash") {
        dirs::home_dir().map(|h| h.join(".bash_profile"))
    } else {
        None
    };

    let config_file_path = config_file.ok_or_else(|| {
        "未检测到支持的 Shell 类型 (Zsh/Bash)，请参考“设置”页面中的指南手动添加环境变量。".to_string()
    })?;

    let content = if config_file_path.exists() {
        fs::read_to_string(&config_file_path).map_err(|e| format!("读取 shell 配置失败: {}", e))?
    } else {
        String::new()
    };

    if content.contains(".fastbox/shims") || content.contains(&shims_dir_str) {
        return Ok("您的 Shell 配置文件中已配置过 Fast Box 环境变量，无需重复操作。".to_string());
    }

    let export_line = format!(
        "\n# Fast Box environment variables\nexport PATH=\"{}/shims:$PATH\"\n",
        home.to_string_lossy()
    );

    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&config_file_path)
        .map_err(|e| format!("打开 shell 配置失败: {}", e))?;

    writeln!(file, "{}", export_line).map_err(|e| format!("追加配置到 shell 失败: {}", e))?;

    let file_name = config_file_path.file_name().and_then(|f| f.to_str()).unwrap_or("配置");
    Ok(format!(
        "已成功将 PATH 追加配置到 ~/{}. 请重启当前运行的所有终端（或运行 'source ~/{}'）以激活全局代理命令！",
        file_name, file_name
    ))
}

#[tauri::command]
pub async fn is_path_configured_in_shell() -> Result<bool, String> {
    let home = get_fastbox_home()?;
    let shims_dir = home.join("shims");
    let shims_dir_str = shims_dir.to_string_lossy().to_string();

    let shell_var = std::env::var("SHELL").unwrap_or_default();
    let config_files = vec![
        dirs::home_dir().map(|h| h.join(".zshrc")),
        dirs::home_dir().map(|h| h.join(".bash_profile")),
        dirs::home_dir().map(|h| h.join(".bashrc")),
    ];

    for config_file in config_files.into_iter().flatten() {
        if config_file.exists() {
            if let Ok(content) = fs::read_to_string(&config_file) {
                if content.contains(".fastbox/shims") || content.contains(&shims_dir_str) {
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}

#[tauri::command]
pub async fn select_workspace_dir() -> Result<Option<String>, String> {
    let res = tokio::task::spawn_blocking(move || {
        rfd::FileDialog::new().pick_folder()
    })
    .await
    .map_err(|e| format!("选择工作区目录线程异常: {}", e))?;

    match res {
        Some(path) => Ok(Some(path.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_manager_start_and_status() {
        let manager = TaskManager::new();
        let task_id = "task_test_1.0.0".to_string();
        manager.start_task(task_id.clone(), "test".to_string(), "1.0.0".to_string());

        let tasks = manager.tasks.lock().unwrap();
        let task = tasks.get(&task_id).unwrap();
        assert_eq!(task.name, "test");
        assert_eq!(task.version, "1.0.0");
        assert_eq!(task.status, TaskStatus::Pending);
        assert_eq!(task.progress, 0);
    }

    #[test]
    fn test_task_manager_active_checks() {
        let manager = TaskManager::new();
        assert!(!manager.is_task_active("node", "24.16.0"));

        manager.start_task("task1".to_string(), "node".to_string(), "24.16.0".to_string());
        assert!(manager.is_task_active("node", "24.16.0"));

        manager.update_status("task1", TaskStatus::Downloading, 50);
        assert!(manager.is_task_active("node", "24.16.0"));

        manager.update_status("task1", TaskStatus::Completed, 100);
        assert!(!manager.is_task_active("node", "24.16.0"));

        manager.update_status("task1", TaskStatus::Failed, 0);
        assert!(!manager.is_task_active("node", "24.16.0"));
    }
}
