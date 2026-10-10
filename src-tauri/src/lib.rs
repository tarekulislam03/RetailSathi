mod printer;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_report_file(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let download_dir = if let Ok(home) = std::env::var("HOME") {
        let dl = std::path::PathBuf::from(&home).join("Downloads");
        if dl.exists() {
            dl
        } else {
            std::path::PathBuf::from(home)
        }
    } else if let Ok(profile) = std::env::var("USERPROFILE") {
        let dl = std::path::PathBuf::from(&profile).join("Downloads");
        if dl.exists() {
            dl
        } else {
            std::path::PathBuf::from(profile)
        }
    } else {
        std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
    };

    let target_path = download_dir.join(&filename);
    std::fs::write(&target_path, bytes).map_err(|e| e.to_string())?;

    Ok(target_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_report_file,
            printer::list_printers,
            printer::print_raw_escpos,
            printer::print_raw_tspl,
            printer::print_raw
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
