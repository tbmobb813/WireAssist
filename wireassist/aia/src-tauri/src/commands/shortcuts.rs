use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

// Define available shortcut actions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ShortcutAction {
    ToggleWindow,
    NewConversation,
    OpenSettings,
    QuickCapture,
    FocusInput,
    ClearConversation,
    ExportCurrent,
    ToggleProfileMenu,
    SearchDocuments,
    ShowPerformance,
    ToggleRecording,
    QuickExport,
}

impl ShortcutAction {
    pub fn display_name(&self) -> &'static str {
        match self {
            ShortcutAction::ToggleWindow => "Toggle Window",
            ShortcutAction::NewConversation => "New Conversation",
            ShortcutAction::OpenSettings => "Open Settings",
            ShortcutAction::QuickCapture => "Quick Capture",
            ShortcutAction::FocusInput => "Focus Input",
            ShortcutAction::ClearConversation => "Clear Conversation",
            ShortcutAction::ExportCurrent => "Export Current",
            ShortcutAction::ToggleProfileMenu => "Toggle Profile Menu",
            ShortcutAction::SearchDocuments => "Search Documents",
            ShortcutAction::ShowPerformance => "Show Performance",
            ShortcutAction::ToggleRecording => "Toggle Recording",
            ShortcutAction::QuickExport => "Quick Export",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            ShortcutAction::ToggleWindow => "Show/hide the main application window",
            ShortcutAction::NewConversation => "Create a new conversation",
            ShortcutAction::OpenSettings => "Open the settings panel",
            ShortcutAction::QuickCapture => "Quick capture input without showing window",
            ShortcutAction::FocusInput => "Focus the chat input field",
            ShortcutAction::ClearConversation => "Clear the current conversation",
            ShortcutAction::ExportCurrent => "Export current conversation to file",
            ShortcutAction::ToggleProfileMenu => "Open/close the profile selection menu",
            ShortcutAction::SearchDocuments => "Open document search interface",
            ShortcutAction::ShowPerformance => "Display performance metrics",
            ShortcutAction::ToggleRecording => "Start/stop voice recording",
            ShortcutAction::QuickExport => "Quick export in default format",
        }
    }

    pub fn default_shortcut(&self) -> &'static str {
        match self {
            ShortcutAction::ToggleWindow => "CommandOrControl+Space",
            ShortcutAction::NewConversation => "CommandOrControl+N",
            ShortcutAction::OpenSettings => "CommandOrControl+Comma",
            ShortcutAction::QuickCapture => "CommandOrControl+Shift+Space",
            ShortcutAction::FocusInput => "CommandOrControl+Shift+I",
            ShortcutAction::ClearConversation => "CommandOrControl+Delete",
            ShortcutAction::ExportCurrent => "CommandOrControl+E",
            ShortcutAction::ToggleProfileMenu => "CommandOrControl+P",
            ShortcutAction::SearchDocuments => "CommandOrControl+Shift+F",
            ShortcutAction::ShowPerformance => "CommandOrControl+Shift+P",
            ShortcutAction::ToggleRecording => "CommandOrControl+R",
            ShortcutAction::QuickExport => "CommandOrControl+Shift+E",
        }
    }

    pub fn category(&self) -> &'static str {
        match self {
            ShortcutAction::ToggleWindow
            | ShortcutAction::FocusInput
            | ShortcutAction::QuickCapture => "Window & Focus",
            ShortcutAction::NewConversation | ShortcutAction::ClearConversation => "Conversation",
            ShortcutAction::ExportCurrent | ShortcutAction::QuickExport => "Export",
            ShortcutAction::ToggleProfileMenu => "Profiles",
            ShortcutAction::SearchDocuments => "Search",
            ShortcutAction::OpenSettings | ShortcutAction::ShowPerformance => "System",
            ShortcutAction::ToggleRecording => "Recording",
        }
    }

    pub fn all_actions() -> Vec<ShortcutAction> {
        vec![
            ShortcutAction::ToggleWindow,
            ShortcutAction::NewConversation,
            ShortcutAction::OpenSettings,
            ShortcutAction::QuickCapture,
            ShortcutAction::FocusInput,
            ShortcutAction::ClearConversation,
            ShortcutAction::ExportCurrent,
            ShortcutAction::ToggleProfileMenu,
            ShortcutAction::SearchDocuments,
            ShortcutAction::ShowPerformance,
            ShortcutAction::ToggleRecording,
            ShortcutAction::QuickExport,
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalShortcut {
    pub action: ShortcutAction,
    pub shortcut: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub shortcuts: Vec<GlobalShortcut>,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            shortcuts: vec![
                GlobalShortcut {
                    action: ShortcutAction::ToggleWindow,
                    shortcut: "CommandOrControl+Space".to_string(),
                    enabled: true,
                },
                GlobalShortcut {
                    action: ShortcutAction::NewConversation,
                    shortcut: "CommandOrControl+N".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::OpenSettings,
                    shortcut: "CommandOrControl+Comma".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::QuickCapture,
                    shortcut: "CommandOrControl+Shift+Space".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::FocusInput,
                    shortcut: "CommandOrControl+Shift+I".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::ClearConversation,
                    shortcut: "CommandOrControl+Delete".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::ExportCurrent,
                    shortcut: "CommandOrControl+E".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::ToggleProfileMenu,
                    shortcut: "CommandOrControl+P".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::SearchDocuments,
                    shortcut: "CommandOrControl+Shift+F".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::ShowPerformance,
                    shortcut: "CommandOrControl+Shift+P".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::ToggleRecording,
                    shortcut: "CommandOrControl+R".to_string(),
                    enabled: false,
                },
                GlobalShortcut {
                    action: ShortcutAction::QuickExport,
                    shortcut: "CommandOrControl+Shift+E".to_string(),
                    enabled: false,
                },
            ],
        }
    }
}

// Global state for managing shortcuts
lazy_static::lazy_static! {
    static ref SHORTCUT_CONFIG: Arc<Mutex<Option<ShortcutConfig>>> = Arc::new(Mutex::new(None));
}

pub fn initialize_shortcut_manager(_app_handle: AppHandle) {
    // Store app handle for future use
    // For now, we'll rely on the existing global shortcut system in lib.rs
    // and just manage the configuration here
    std::thread::spawn(move || {
        // Initialize with default config
        let mut guard = SHORTCUT_CONFIG.lock().unwrap();
        *guard = Some(ShortcutConfig::default());
    });
}

#[tauri::command]
pub async fn get_shortcut_config(
    db: tauri::State<'_, crate::database::Database>,
) -> Result<ShortcutConfig, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Try to get existing config from database
    let config_json: Option<String> = conn
        .prepare("SELECT value FROM settings WHERE key = 'shortcut_config'")
        .and_then(|mut stmt| stmt.query_row([], |row| row.get(0)).optional())
        .map_err(|e| e.to_string())?;

    match config_json {
        Some(json) => {
            serde_json::from_str(&json).map_err(|e| format!("Failed to parse config: {}", e))
        }
        None => Ok(ShortcutConfig::default()),
    }
}

#[tauri::command]
pub async fn update_shortcut_config(
    config: ShortcutConfig,
    db: tauri::State<'_, crate::database::Database>,
    _app: AppHandle,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Save config to database
    let config_json =
        serde_json::to_string(&config).map_err(|e| format!("Failed to serialize config: {}", e))?;

    conn.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .and_then(|mut stmt| stmt.execute(["shortcut_config", &config_json]))
        .map_err(|e| e.to_string())?;

    drop(conn);

    // Update the configuration
    let mut guard = SHORTCUT_CONFIG.lock().map_err(|e| e.to_string())?;
    *guard = Some(config);

    Ok(())
}

#[tauri::command]
pub async fn validate_shortcut(shortcut: String) -> Result<bool, String> {
    // Basic validation - check format
    if shortcut.trim().is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }

    // Check for basic modifier + key pattern
    let has_modifier = shortcut.contains("Command")
        || shortcut.contains("Control")
        || shortcut.contains("Ctrl")
        || shortcut.contains("Alt")
        || shortcut.contains("Shift");

    let has_plus = shortcut.contains("+");

    if !has_modifier || !has_plus {
        return Err(
            "Shortcut must include a modifier key (CommandOrControl, Alt, Shift) and a main key"
                .to_string(),
        );
    }

    Ok(true)
}

#[tauri::command]
pub async fn get_available_actions() -> Result<Vec<ShortcutAction>, String> {
    Ok(ShortcutAction::all_actions())
}
