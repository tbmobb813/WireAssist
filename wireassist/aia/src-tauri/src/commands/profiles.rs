use crate::database::{profiles::NewProfile, profiles::Profile, Database};
use tauri::State;

#[tauri::command]
pub async fn create_profile(
    db: State<'_, Database>,
    profile_data: NewProfile,
) -> Result<Profile, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Profile::create(&conn, profile_data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_profile(db: State<'_, Database>, id: String) -> Result<Option<Profile>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Profile::get_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_profiles(db: State<'_, Database>) -> Result<Vec<Profile>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Profile::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_profile(db: State<'_, Database>) -> Result<Option<Profile>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Profile::get_active(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_active_profile(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Profile::set_active(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_profile(
    db: State<'_, Database>,
    id: String,
    profile_data: NewProfile,
) -> Result<Profile, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Profile::update(&conn, &id, profile_data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_profile(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Profile::delete(&conn, &id).map_err(|e| e.to_string())
}
