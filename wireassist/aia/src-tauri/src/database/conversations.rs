use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub model: String,
    pub provider: String,
    pub system_prompt: Option<String>,
    pub parent_conversation_id: Option<String>,
    pub branch_point_message_id: Option<String>,
    // Note: 'deleted' and 'deleted_at' are stored in DB but are not exposed to the API struct
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewConversation {
    pub title: String,
    pub model: String,
    pub provider: String,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewConversationWithId {
    pub id: String,
    pub title: String,
    pub model: String,
    pub provider: String,
    pub system_prompt: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Conversation {
    pub fn create(conn: &Connection, new_conv: NewConversation) -> Result<Self> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, model, provider, system_prompt, parent_conversation_id, branch_point_message_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)",
            params![&id, &new_conv.title, now, now, &new_conv.model, &new_conv.provider, &new_conv.system_prompt],
        )?;

        Ok(Conversation {
            id,
            title: new_conv.title,
            created_at: now,
            updated_at: now,
            model: new_conv.model,
            provider: new_conv.provider,
            system_prompt: new_conv.system_prompt,
            parent_conversation_id: None,
            branch_point_message_id: None,
        })
    }

    pub fn create_with_id(conn: &Connection, new_conv: NewConversationWithId) -> Result<Self> {
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, model, provider, system_prompt, parent_conversation_id, branch_point_message_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)",
            params![&new_conv.id, &new_conv.title, new_conv.created_at, new_conv.updated_at, &new_conv.model, &new_conv.provider, &new_conv.system_prompt],
        )?;

        Ok(Conversation {
            id: new_conv.id,
            title: new_conv.title,
            created_at: new_conv.created_at,
            updated_at: new_conv.updated_at,
            model: new_conv.model,
            provider: new_conv.provider,
            system_prompt: new_conv.system_prompt,
            parent_conversation_id: None,
            branch_point_message_id: None,
        })
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Self>> {
        // Only return non-deleted conversations
        let mut stmt = conn.prepare("SELECT id, title, created_at, updated_at, model, provider, system_prompt, parent_conversation_id, branch_point_message_id FROM conversations WHERE id = ?1 AND deleted = 0")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                model: row.get(4)?,
                provider: row.get(5)?,
                system_prompt: row.get(6)?,
                parent_conversation_id: row.get(7)?,
                branch_point_message_id: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_all(conn: &Connection, limit: i64) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare("SELECT id, title, created_at, updated_at, model, provider, system_prompt, parent_conversation_id, branch_point_message_id FROM conversations WHERE deleted = 0 ORDER BY updated_at DESC LIMIT ?1")?;
        let conversations = stmt.query_map(params![limit], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                model: row.get(4)?,
                provider: row.get(5)?,
                system_prompt: row.get(6)?,
                parent_conversation_id: row.get(7)?,
                branch_point_message_id: row.get(8)?,
            })
        })?;
        conversations.collect()
    }

    pub fn update_title(conn: &Connection, id: &str, new_title: &str) -> Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        conn.execute(
            "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_title, now, id],
        )?;
        Ok(())
    }

    pub fn touch(conn: &Connection, id: &str) -> Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        // Soft-delete by default: mark deleted flag and timestamp
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        conn.execute(
            "UPDATE conversations SET deleted = 1, deleted_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn restore(conn: &Connection, id: &str) -> Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        conn.execute(
            "UPDATE conversations SET deleted = 0, deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn search(conn: &Connection, query: &str, limit: i64) -> Result<Vec<Self>> {
        let search_pattern = format!("%{}%", query);
        let mut stmt = conn.prepare("SELECT id, title, created_at, updated_at, model, provider, system_prompt, parent_conversation_id, branch_point_message_id FROM conversations WHERE deleted = 0 AND title LIKE ?1 ORDER BY updated_at DESC LIMIT ?2")?;
        let conversations = stmt.query_map(params![search_pattern, limit], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                model: row.get(4)?,
                provider: row.get(5)?,
                system_prompt: row.get(6)?,
                parent_conversation_id: row.get(7)?,
                branch_point_message_id: row.get(8)?,
            })
        })?;
        conversations.collect()
    }

    // Create a new conversation as a branch from a specific message
    pub fn create_branch(
        conn: &Connection,
        parent_conversation_id: &str,
        branch_point_message_id: &str,
        title: String,
    ) -> Result<Self> {
        // Get the parent conversation to inherit model and provider
        let parent = Self::get_by_id(conn, parent_conversation_id)?
            .ok_or_else(|| rusqlite::Error::InvalidPath("Parent conversation not found".into()))?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, model, provider, system_prompt, parent_conversation_id, branch_point_message_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &id,
                &title,
                now,
                now,
                &parent.model,
                &parent.provider,
                &parent.system_prompt,
                parent_conversation_id,
                branch_point_message_id
            ],
        )?;

        // Copy all messages from parent up to the branch point
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, timestamp, tokens_used)
             SELECT 
                lower(hex(randomblob(16))),
                ?1,
                role,
                content,
                timestamp,
                tokens_used
             FROM messages 
             WHERE conversation_id = ?2 
               AND timestamp <= (SELECT timestamp FROM messages WHERE id = ?3)
             ORDER BY timestamp",
            params![&id, parent_conversation_id, branch_point_message_id],
        )?;

        Ok(Conversation {
            id,
            title,
            created_at: now,
            updated_at: now,
            model: parent.model,
            provider: parent.provider,
            system_prompt: parent.system_prompt,
            parent_conversation_id: Some(parent_conversation_id.to_string()),
            branch_point_message_id: Some(branch_point_message_id.to_string()),
        })
    }

    // Get all branches of a conversation
    pub fn get_branches(conn: &Connection, conversation_id: &str) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare("SELECT id, title, created_at, updated_at, model, provider, system_prompt, parent_conversation_id, branch_point_message_id FROM conversations WHERE parent_conversation_id = ?1 AND deleted = 0 ORDER BY created_at DESC")?;
        let conversations = stmt.query_map(params![conversation_id], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                model: row.get(4)?,
                provider: row.get(5)?,
                system_prompt: row.get(6)?,
                parent_conversation_id: row.get(7)?,
                branch_point_message_id: row.get(8)?,
            })
        })?;
        conversations.collect()
    }
}
