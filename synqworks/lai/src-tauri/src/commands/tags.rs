use crate::database::{tags::*, Database};
use tauri::State;

#[tauri::command]
pub async fn create_tag(
    db: State<'_, Database>,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let new_tag = NewTag { name, color };
    Tag::create(&conn, new_tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tag(db: State<'_, Database>, id: String) -> Result<Option<Tag>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::get_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tag_by_name(db: State<'_, Database>, name: String) -> Result<Option<Tag>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::get_by_name(&conn, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_tags(db: State<'_, Database>) -> Result<Vec<Tag>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_tags(db: State<'_, Database>, query: String) -> Result<Vec<Tag>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::search(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_tag(
    db: State<'_, Database>,
    id: String,
    name: String,
    color: Option<String>,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::update(&conn, &id, &name, color.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tag(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversation_tags(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<Vec<Tag>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::get_for_conversation(&conn, &conversation_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_tag_to_conversation(
    db: State<'_, Database>,
    conversation_id: String,
    tag_id: String,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::add_to_conversation(&conn, &conversation_id, &tag_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_tag_from_conversation(
    db: State<'_, Database>,
    conversation_id: String,
    tag_id: String,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::remove_from_conversation(&conn, &conversation_id, &tag_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversations_by_tag(
    db: State<'_, Database>,
    tag_id: String,
) -> Result<Vec<String>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::get_conversations_with_tag(&conn, &tag_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_or_get_tag(
    db: State<'_, Database>,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    Tag::create_or_get(&conn, &name, color.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_tags_to_conversation_bulk(
    db: State<'_, Database>,
    conversation_id: String,
    tag_names: Vec<String>,
) -> Result<Vec<Tag>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let mut created_tags = Vec::new();

    for tag_name in tag_names {
        // Create or get the tag
        let tag = Tag::create_or_get(&conn, &tag_name, None).map_err(|e| e.to_string())?;

        // Add to conversation
        Tag::add_to_conversation(&conn, &conversation_id, &tag.id).map_err(|e| e.to_string())?;

        created_tags.push(tag);
    }

    Ok(created_tags)
}
