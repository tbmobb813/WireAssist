// src-tauri/src/database/mod.rs
// Database module: declare submodules and provide the Database manager.

pub mod conversations;
pub mod messages;
pub mod profiles;
pub mod schema;
pub mod settings;
pub mod tags;
pub mod workspace_templates;

use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

/// Database manager that holds the connection
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Initialize the database with schema
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Initialize schema
        schema::create_tables(&conn)?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    /// Get a reference to the connection
    pub fn conn(&self) -> &Mutex<Connection> {
        &self.conn
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::conversations::{Conversation as DbConversation, NewConversation};
    use crate::database::messages::{Message as DbMessage, NewMessage};
    use std::path::PathBuf;

    #[test]
    fn create_conversation_and_message_roundtrip() {
        // Use an in-memory SQLite database for tests
        let db = Database::new(PathBuf::from(":memory:")).expect("db init");
        let conn = db.conn().lock().expect("lock conn");

        // Create a conversation
        let new_conv = NewConversation {
            title: "Test conv".to_string(),
            model: "gpt-test".to_string(),
            provider: "local".to_string(),
            system_prompt: None,
        };

        let conv = DbConversation::create(&conn, new_conv).expect("create conv");
        let fetched = DbConversation::get_by_id(&conn, &conv.id).expect("get conv");
        assert!(fetched.is_some());

        // Create a message and ensure it can be retrieved
        let new_msg = NewMessage {
            conversation_id: conv.id.clone(),
            role: "user".to_string(),
            content: "hello test".to_string(),
            tokens_used: None,
        };

        let msg = DbMessage::create(&conn, new_msg).expect("create msg");
        let msgs = DbMessage::get_by_conversation(&conn, &conv.id).expect("get msgs");
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].content, msg.content);

        // Soft-delete conversation and ensure it is hidden
        DbConversation::delete(&conn, &conv.id).expect("soft delete conv");
        let hidden = DbConversation::get_by_id(&conn, &conv.id).expect("get after delete");
        assert!(hidden.is_none());

        // Restore and ensure conversation is visible again and messages remain
        DbConversation::restore(&conn, &conv.id).expect("restore conv");
        let restored = DbConversation::get_by_id(&conn, &conv.id).expect("get after restore");
        assert!(restored.is_some());
        let msgs_after =
            DbMessage::get_by_conversation(&conn, &conv.id).expect("get msgs after restore");
        assert_eq!(msgs_after.len(), 1);
    }
}
