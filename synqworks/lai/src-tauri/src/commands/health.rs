use tauri::command;

#[command]
pub fn ping() -> Result<String, String> {
    Ok("ok".into())
}
