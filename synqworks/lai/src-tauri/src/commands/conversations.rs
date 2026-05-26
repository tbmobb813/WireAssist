use crate::database::{conversations::*, Database};
use tauri::State;

#[tauri::command]
pub async fn create_conversation(
    db: State<'_, Database>,
    title: String,
    model: String,
    provider: String,
    system_prompt: Option<String>,
) -> Result<Conversation, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let new_conv = NewConversation {
        title,
        model,
        provider,
        system_prompt,
    };
    Conversation::create(&conn, new_conv).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversation(
    db: State<'_, Database>,
    id: String,
) -> Result<Option<Conversation>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::get_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_conversations(
    db: State<'_, Database>,
    limit: i64,
) -> Result<Vec<Conversation>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::get_all(&conn, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_conversation_title(
    db: State<'_, Database>,
    id: String,
    title: String,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::update_title(&conn, &id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_conversation(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_conversation(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::restore(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_conversations(
    db: State<'_, Database>,
    query: String,
    limit: i64,
) -> Result<Vec<Conversation>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::search(&conn, &query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cleanup_conversations(db: State<'_, Database>) -> Result<String, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Get all conversations and count them
    let all_conversations = Conversation::get_all(&conn, 10000) // Get up to 10k conversations for cleanup
        .map_err(|e| e.to_string())?;

    let mut deleted_count = 0;

    // Mark all conversations as deleted (soft delete)
    for conv in &all_conversations {
        Conversation::delete(&conn, &conv.id).map_err(|e| e.to_string())?;
        deleted_count += 1;
    }

    Ok(format!("Deleted {} conversations", deleted_count))
}

#[tauri::command]
pub async fn create_conversation_branch(
    db: State<'_, Database>,
    parent_conversation_id: String,
    branch_point_message_id: String,
    title: String,
) -> Result<Conversation, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::create_branch(
        &conn,
        &parent_conversation_id,
        &branch_point_message_id,
        title,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversation_branches(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<Vec<Conversation>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Conversation::get_branches(&conn, &conversation_id).map_err(|e| e.to_string())
}
