// Consolidated Tauri entrypoint: initializes database, registers plugins and commands
// This is the authoritative run() that `src/main.rs` calls.
pub mod commands;
pub mod database;
pub mod git;
mod ipc;
pub mod project;

use std::path::PathBuf;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugins (register those that don't need extra setup here)
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        // Optional: attach a log plugin during debug for easier troubleshooting
        .setup(|app| {
            if cfg!(debug_assertions) {
                let _ = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }

            // Prepare app data directory and DB
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            let db_path: PathBuf = app_data_dir.join("database.db");
            let db = database::Database::new(db_path).expect("Failed to initialize database");
            app.manage(db);

            // Register a global shortcut (CommandOrControl+Space) to toggle main window.
            // Do this by constructing the plugin with its handler here (registering it once).
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                use tauri_plugin_global_shortcut::{Builder as ShortcutBuilder, ShortcutState};

                let builder = ShortcutBuilder::new()
                    .with_shortcuts(["CommandOrControl+Space"])
                    .unwrap_or_else(|e| {
                        eprintln!("failed to parse shortcut: {}", e);
                        ShortcutBuilder::new()
                    })
                    .with_handler(|app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            if let Some(window) = app.get_webview_window("main") {
                                match window.is_visible() {
                                    Ok(true) => {
                                        let _ = window.hide();
                                    }
                                    _ => {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        }
                    });

                let _ = app.handle().plugin(builder.build());
            }

            // Create a system tray (desktop only)
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                use tauri::{menu::MenuBuilder, tray::TrayIconBuilder, Manager};

                let handle = app.handle();

                // Build a small context menu with Toggle, New Conversation, Settings, and Quit actions.
                if let Ok(menu) = MenuBuilder::new(handle)
                    .text("toggle", "Show/Hide")
                    .text("new-convo", "New Conversation")
                    .text("settings", "Settings")
                    .text("quit", "Quit")
                    .build()
                {
                    // Make the builder mutable so we can optionally attach an icon at runtime
                    let mut tray_builder = TrayIconBuilder::with_id("main")
                        .menu(&menu)
                        .tooltip("Linux AI Assistant")
                        .title("Linux AI Assistant")
                        .on_menu_event(|app, event| {
                            let id = event.id().0.clone();
                            match id.as_str() {
                                "toggle" => {
                                    if let Some(window) = app.get_webview_window("main") {
                                        match window.is_visible() {
                                            Ok(true) => {
                                                let _ = window.hide();
                                            }
                                            _ => {
                                                let _ = window.show();
                                                let _ = window.set_focus();
                                            }
                                        }
                                    }
                                }
                                "new-convo" => {
                                    // Bring window to front and ask frontend to create a new conversation
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                    let _ = app.emit_to(
                                        tauri::EventTarget::any(),
                                        "tray://new-conversation",
                                        (),
                                    );
                                }
                                "settings" => {
                                    // Bring window to front and ask frontend to open settings panel
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                    let _ = app.emit_to(
                                        tauri::EventTarget::any(),
                                        "tray://open-settings",
                                        (),
                                    );
                                }
                                "quit" => {
                                    std::process::exit(0);
                                }
                                _ => {}
                            }
                        });

                    // Try bundled tray icon (non-fatal if missing)
                    if let Ok(resource_dir) = app.path().resource_dir() {
                        let icon_path = resource_dir.join("icons/icon.png");
                        if icon_path.exists() {
                            match image::open(&icon_path) {
                                Ok(img) => {
                                    let rgba = img.to_rgba8();
                                    let (w, h) = rgba.dimensions();
                                    let data = rgba.into_raw();
                                    // Tauri v2: new_owned(data, width, height)
                                    let tauri_image = tauri::image::Image::new_owned(data, w, h);
                                    tray_builder = tray_builder.icon(tauri_image);
                                }
                                Err(e) => {
                                    eprintln!("failed to decode tray icon {:?}: {}", icon_path, e)
                                }
                            }
                        }
                    }

                    // Dev-time fallback: src-tauri/icons/icon.png relative to the exe dir
                    if let Ok(mut exe_path) = std::env::current_exe() {
                        exe_path.pop(); // exe dir
                        let dev_icon = exe_path
                            .join("..")
                            .join("src-tauri")
                            .join("icons")
                            .join("icon.png");
                        if dev_icon.exists() {
                            match image::open(&dev_icon) {
                                Ok(img) => {
                                    let rgba = img.to_rgba8();
                                    let (w, h) = rgba.dimensions();
                                    let data = rgba.into_raw();
                                    let tauri_image = tauri::image::Image::new_owned(data, w, h);
                                    tray_builder = tray_builder.icon(tauri_image);
                                }
                                Err(e) => eprintln!(
                                    "failed to decode dev tray icon {:?}: {}",
                                    dev_icon, e
                                ),
                            }
                        }
                    }

                    if let Err(e) = tray_builder.build(handle) {
                        eprintln!("failed to build tray icon: {}", e);
                    }
                }
            }

            println!("Database initialized successfully!");

            // Initialize shortcut manager
            commands::shortcuts::initialize_shortcut_manager(app.handle().clone());

            // Restore window state on startup
            let app_handle = app.handle().clone();
            let db_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Some(db_state) = db_handle.try_state::<database::Database>() {
                    if let Err(e) =
                        commands::window::restore_window_state(app_handle.clone(), db_state).await
                    {
                        eprintln!("Failed to restore window state: {}", e);
                    }
                }
            });

            // Set up window event listeners for automatic state saving
            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();

                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                            let app_handle_clone = app_handle.clone();

                            // Debounce saves - only save after 500ms of no changes
                            tauri::async_runtime::spawn(async move {
                                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                                let app_handle_for_state = app_handle_clone.clone();
                                if let Some(db_state) =
                                    app_handle_for_state.try_state::<database::Database>()
                                {
                                    if let Err(e) = commands::window::save_window_state(
                                        app_handle_clone,
                                        db_state,
                                    )
                                    .await
                                    {
                                        eprintln!("Failed to save window state: {}", e);
                                    }
                                }
                            });
                        }
                        _ => {}
                    }
                });
            } // Start CLI IPC server
            crate::ipc::start_ipc_server(app.handle().clone());
            Ok(())
        })
        // Register Tauri commands implemented in `src-tauri/src/commands`
        .invoke_handler(tauri::generate_handler![
            // conversations
            commands::conversations::create_conversation,
            commands::conversations::get_conversation,
            commands::conversations::get_all_conversations,
            commands::conversations::update_conversation_title,
            commands::conversations::delete_conversation,
            commands::conversations::restore_conversation,
            commands::conversations::search_conversations,
            commands::conversations::cleanup_conversations,
            commands::conversations::create_conversation_branch,
            commands::conversations::get_conversation_branches,
            // messages
            commands::messages::create_message,
            commands::messages::get_conversation_messages,
            commands::messages::get_last_messages,
            commands::messages::search_messages,
            commands::messages::update_message,
            commands::messages::delete_message,
            commands::messages::get_conversation_token_count,
            commands::messages::get_last_assistant_message,
            // settings
            commands::settings::set_setting,
            commands::settings::get_setting,
            commands::settings::get_all_settings,
            commands::settings::delete_setting,
            // window
            commands::window::toggle_main_window,
            commands::window::save_window_state,
            commands::window::restore_window_state,
            commands::window::get_window_state,
            commands::window::reset_window_state,
            // health
            commands::health::ping,
            // provider
            commands::provider::provider_openai_generate,
            commands::provider::provider_openai_stream,
            commands::provider::provider_anthropic_generate,
            commands::provider::provider_gemini_generate,
            commands::provider::provider_ollama_generate,
            commands::provider::provider_ollama_stream,
            commands::provider::ollama_list_models,
            commands::provider::ollama_pull_model,
            commands::provider::ollama_check_connection,
            commands::provider::set_api_key,
            commands::provider::get_api_key,
            // export/import
            commands::export::export_conversations_json,
            commands::export::export_conversation_markdown,
            commands::export::export_conversation_html,
            commands::export::export_conversation_pdf,
            commands::export::save_export_file,
            commands::export::save_export_file_bytes,
            commands::export::import_conversations_json,
            commands::export::load_import_file,
            commands::export::export_single_conversation_json,
            commands::export::save_single_conversation_export,
            // git
            commands::git::get_git_context,
            commands::git::format_git_context,
            // project watcher
            commands::project::set_project_root,
            commands::project::stop_project_watch,
            commands::project::update_ignore_patterns,
            commands::project::search_project_files,
            commands::project::search_project_files_in_path,
            commands::project::detect_project_type,
            // performance monitoring
            commands::performance::get_performance_metrics,
            commands::performance::get_database_metrics,
            commands::performance::get_full_performance_snapshot,
            // profiles
            commands::profiles::create_profile,
            commands::profiles::get_profile,
            commands::profiles::get_all_profiles,
            commands::profiles::get_active_profile,
            commands::profiles::set_active_profile,
            commands::profiles::update_profile,
            commands::profiles::delete_profile,
            // shortcuts
            commands::shortcuts::get_shortcut_config,
            commands::shortcuts::update_shortcut_config,
            commands::shortcuts::validate_shortcut,
            commands::shortcuts::get_available_actions,
            // tags
            commands::tags::create_tag,
            commands::tags::get_tag,
            commands::tags::get_tag_by_name,
            commands::tags::get_all_tags,
            commands::tags::search_tags,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            commands::tags::get_conversation_tags,
            commands::tags::add_tag_to_conversation,
            commands::tags::remove_tag_from_conversation,
            commands::tags::get_conversations_by_tag,
            commands::tags::create_or_get_tag,
            commands::tags::add_tags_to_conversation_bulk,
            // workspace templates
            commands::workspace_templates::create_workspace_template,
            commands::workspace_templates::get_workspace_template,
            commands::workspace_templates::get_all_workspace_templates,
            commands::workspace_templates::get_workspace_templates_by_category,
            commands::workspace_templates::get_workspace_template_categories,
            commands::workspace_templates::update_workspace_template,
            commands::workspace_templates::delete_workspace_template,
            commands::workspace_templates::search_workspace_templates,
            // updater
            commands::updater::check_for_updates,
            commands::updater::download_and_install_update,
            commands::updater::get_current_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
