mod system;
mod config;
mod state;
mod registry;
mod commands;
mod download;
mod extract;
mod shims;
mod verify;
mod utils;
mod cli;

pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("--cli") {
        match cli::run_cli(&args[1..]) {
            Ok(code) => std::process::exit(code),
            Err(err) => {
                eprintln!("{}", err);
                std::process::exit(1);
            }
        }
    }

    if args.first().map(String::as_str) == Some("--shim") {
        let Some(bin_name) = args.get(1) else {
            eprintln!("Usage: fast-box --shim <bin> [args...]");
            std::process::exit(1);
        };

        match cli::run_shim(bin_name, &args[2..]) {
            Ok(code) => std::process::exit(code),
            Err(err) => {
                eprintln!("{}", err);
                std::process::exit(1);
            }
        }
    }

    // 前置检查：在应用核心启动前，如果工作区创建失败则退出
    if let Err(err) = system::initialize_workspace() {
        eprintln!("Initialization failure: {}", err);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .manage(commands::TaskManager::new())
        .plugin(tauri_plugin_shell::init()) // Tauri v2 所需 Shell 插件
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::list_packages,
            commands::install_package_version,
            commands::use_package_version,
            commands::uninstall_package_version,
            commands::verify_package_version,
            commands::get_task_logs,
            commands::get_settings,
            commands::save_settings,
            commands::get_recent_activities,
            commands::check_path_status,
            commands::get_storage_usage,
            commands::clean_cache,
            commands::clean_logs,
            commands::auto_configure_path,
            commands::select_workspace_dir,
        ])


        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
