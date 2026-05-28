// src-tauri/src/commands/mod.rs
// Public re-exports for the commands submodules. Each submodule lives in its
// own file (conversations.rs, messages.rs, settings.rs).

pub mod conversations;
pub mod export;
pub mod git;
pub mod health;
pub mod messages;
pub mod performance;
pub mod profiles;
pub mod project;
pub mod provider;
pub mod run;
pub mod settings;
pub mod shortcuts;
pub mod tags;
pub mod updater;
pub mod window;
pub mod workspace_templates;

// src-tauri/Cargo.toml (Updated dependencies)
// Add this to your existing Cargo.toml

/*
[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
tauri-plugin-notification = "2.0"
tauri-plugin-global-shortcut = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1.8", features = ["v4", "serde"] }
*/
