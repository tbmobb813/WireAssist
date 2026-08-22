use crate::database::{settings::*, Database};
use tauri::State;

#[tauri::command]
pub async fn set_setting(
    db: State<'_, Database>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Setting::set(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_setting(db: State<'_, Database>, key: String) -> Result<Option<String>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Setting::get(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_settings(db: State<'_, Database>) -> Result<Vec<Setting>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Setting::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_setting(db: State<'_, Database>, key: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Setting::delete(&conn, &key).map_err(|e| e.to_string())
}
