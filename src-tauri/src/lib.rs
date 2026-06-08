mod system;
mod state;
mod registry;
mod commands;
mod download;
mod extract;
mod shims;
mod verify;
mod utils;

pub fn run() {
    // 前置检查：在应用核心启动前，如果工作区创建失败则退出
    if let Err(err) = system::initialize_workspace() {
        eprintln!("Initialization failure: {}", err);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init()) // Tauri v2 所需 Shell 插件
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::list_packages,
            commands::install_package_version,
            commands::use_package_version,
            commands::uninstall_package_version,
            commands::verify_package_version,
            commands::get_task_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
