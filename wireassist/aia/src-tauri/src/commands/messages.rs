use crate::database::{messages::*, Database};
use rusqlite::Connection;
use tauri::State;

// Helper function for synchronous access (used by IPC)
pub fn get_last_assistant_message_sync(conn: &Connection) -> Result<Option<Message>, String> {
    // Get the most recently updated conversation
    let conversations = crate::database::conversations::Conversation::get_all(conn, 1)
        .map_err(|e| e.to_string())?;

    if conversations.is_empty() {
        return Ok(None);
    }

    // Get messages from that conversation, filtered by role='assistant'
    let mut stmt = conn
        .prepare(
            "SELECT id, conversation_id, role, content, timestamp, tokens_used
         FROM messages
         WHERE conversation_id = ?1 AND role = 'assistant' AND deleted = 0
         ORDER BY timestamp DESC
         LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let mut messages = stmt
        .query_map([&conversations[0].id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tokens_used: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    match messages.next() {
        Some(Ok(msg)) => Ok(Some(msg)),
        Some(Err(e)) => Err(e.to_string()),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn create_message(
    db: State<'_, Database>,
    conversation_id: String,
    role: String,
    content: String,
    tokens_used: Option<i64>,
) -> Result<Message, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let new_msg = NewMessage {
        conversation_id,
        role,
        content,
        tokens_used,
    };
    // Create the user message
    let created = Message::create(&conn, new_msg).map_err(|e| e.to_string())?;

    // Dev helper: if DEV_ECHO_RESPONSES=1 is set, automatically create an assistant reply
    // This is handy for local development to test end-to-end flow without an LLM provider.
    if std::env::var("DEV_ECHO_RESPONSES").is_ok() && created.role == "user" {
        let assistant = NewMessage {
            conversation_id: created.conversation_id.clone(),
            role: "assistant".to_string(),
            content: format!("Echo: {}", created.content),
            tokens_used: None,
        };
        // ignore result; if it errors we still return the original created message
        let _ = Message::create(&conn, assistant);
    }

    Ok(created)
}

#[tauri::command]
pub async fn get_conversation_messages(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<Vec<Message>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Message::get_by_conversation(&conn, &conversation_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_last_messages(
    db: State<'_, Database>,
    conversation_id: String,
    n: i64,
) -> Result<Vec<Message>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Message::get_last_n(&conn, &conversation_id, n).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_messages(
    db: State<'_, Database>,
    query: String,
    limit: i64,
) -> Result<Vec<Message>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Message::search(&conn, &query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_message(
    db: State<'_, Database>,
    id: String,
    content: String,
) -> Result<Message, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Message::update(&conn, &id, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_message(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Message::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversation_token_count(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<i64, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Message::get_conversation_token_count(&conn, &conversation_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_last_assistant_message(
    db: State<'_, Database>,
) -> Result<Option<Message>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Get the most recently updated conversation
    let conversations = crate::database::conversations::Conversation::get_all(&conn, 1)
        .map_err(|e| e.to_string())?;

    if conversations.is_empty() {
        return Ok(None);
    }

    // Get messages from that conversation, filtered by role='assistant'
    let mut stmt = conn
        .prepare(
            "SELECT id, conversation_id, role, content, timestamp, tokens_used
         FROM messages
         WHERE conversation_id = ?1 AND role = 'assistant' AND deleted = 0
         ORDER BY timestamp DESC
         LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let mut messages = stmt
        .query_map([&conversations[0].id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tokens_used: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    match messages.next() {
        Some(Ok(msg)) => Ok(Some(msg)),
        Some(Err(e)) => Err(e.to_string()),
        None => Ok(None),
    }
}
