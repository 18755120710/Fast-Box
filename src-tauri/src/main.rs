// 避免在 Windows 上打包 Release 时出现 CMD 黑窗
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    fast_box_lib::run();
}
