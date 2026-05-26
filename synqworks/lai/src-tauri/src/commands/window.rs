use crate::database::settings::Setting;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 800,
            height: 600,
            maximized: false,
        }
    }
}

#[tauri::command]
pub fn toggle_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => window.hide().map_err(|e| e.to_string()),
            _ => {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())
            }
        }
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub async fn save_window_state(
    app: AppHandle,
    db: tauri::State<'_, crate::database::Database>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let position = window.outer_position().map_err(|e| e.to_string())?;
        let size = window.outer_size().map_err(|e| e.to_string())?;
        let maximized = window.is_maximized().map_err(|e| e.to_string())?;

        let window_state = WindowState {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            maximized,
        };

        let conn = db.conn().lock().map_err(|e| e.to_string())?;
        // Use settings helper to ensure updated_at is set to avoid NOT NULL constraint errors
        Setting::set_json(&conn, "window_state", &window_state).map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub async fn restore_window_state(
    app: AppHandle,
    db: tauri::State<'_, crate::database::Database>,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    let state_json: Option<String> = conn
        .prepare("SELECT value FROM settings WHERE key = 'window_state'")
        .and_then(|mut stmt| stmt.query_row([], |row| row.get(0)).optional())
        .map_err(|e| e.to_string())?;

    drop(conn);

    if let Some(json) = state_json {
        let window_state: WindowState = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse window state: {}", e))?;

        if let Some(window) = app.get_webview_window("main") {
            // Restore size first
            let size = PhysicalSize::new(window_state.width, window_state.height);
            window.set_size(size).map_err(|e| e.to_string())?;

            // Then restore position
            let position = PhysicalPosition::new(window_state.x, window_state.y);
            window.set_position(position).map_err(|e| e.to_string())?;

            // Finally restore maximized state
            if window_state.maximized {
                window.maximize().map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_window_state(app: AppHandle) -> Result<WindowState, String> {
    if let Some(window) = app.get_webview_window("main") {
        let position = window.outer_position().map_err(|e| e.to_string())?;
        let size = window.outer_size().map_err(|e| e.to_string())?;
        let maximized = window.is_maximized().map_err(|e| e.to_string())?;

        Ok(WindowState {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            maximized,
        })
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub async fn reset_window_state(
    app: AppHandle,
    db: tauri::State<'_, crate::database::Database>,
) -> Result<(), String> {
    // Delete stored window state
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    conn.prepare("DELETE FROM settings WHERE key = 'window_state'")
        .and_then(|mut stmt| stmt.execute([]))
        .map_err(|e| e.to_string())?;
    drop(conn);

    // Reset to default position and size
    if let Some(window) = app.get_webview_window("main") {
        let default_state = WindowState::default();

        let size = PhysicalSize::new(default_state.width, default_state.height);
        window.set_size(size).map_err(|e| e.to_string())?;

        let position = PhysicalPosition::new(default_state.x, default_state.y);
        window.set_position(position).map_err(|e| e.to_string())?;

        if default_state.maximized {
            window.maximize().map_err(|e| e.to_string())?;
        } else {
            window.unmaximize().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
