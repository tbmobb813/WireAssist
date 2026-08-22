use crate::database::{workspace_templates::*, Database};
use tauri::State;

#[tauri::command]
pub async fn create_workspace_template(
    database: State<'_, Database>,
    template: NewWorkspaceTemplate,
) -> Result<WorkspaceTemplate, String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::create(&conn, template).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workspace_template(
    database: State<'_, Database>,
    id: String,
) -> Result<Option<WorkspaceTemplate>, String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::get_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_workspace_templates(
    database: State<'_, Database>,
) -> Result<Vec<WorkspaceTemplate>, String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workspace_templates_by_category(
    database: State<'_, Database>,
    category: String,
) -> Result<Vec<WorkspaceTemplate>, String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::get_by_category(&conn, &category).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workspace_template_categories(
    database: State<'_, Database>,
) -> Result<Vec<String>, String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::get_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_workspace_template(
    database: State<'_, Database>,
    id: String,
    template: NewWorkspaceTemplate,
) -> Result<(), String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::update(&conn, &id, template).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_workspace_template(
    database: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_workspace_templates(
    database: State<'_, Database>,
    query: String,
) -> Result<Vec<WorkspaceTemplate>, String> {
    let conn = database.conn().lock().map_err(|e| e.to_string())?;
    WorkspaceTemplate::search(&conn, &query).map_err(|e| e.to_string())
}
