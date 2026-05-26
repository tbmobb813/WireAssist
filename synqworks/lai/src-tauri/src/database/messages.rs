use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    pub tokens_used: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewMessage {
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub tokens_used: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewMessageWithId {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    pub tokens_used: Option<i64>,
}

impl Message {
    pub fn create(conn: &Connection, new_msg: NewMessage) -> Result<Self> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, timestamp, tokens_used) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&id, &new_msg.conversation_id, &new_msg.role, &new_msg.content, now, new_msg.tokens_used],
        )?;
        super::conversations::Conversation::touch(conn, &new_msg.conversation_id)?;
        Ok(Message {
            id,
            conversation_id: new_msg.conversation_id,
            role: new_msg.role,
            content: new_msg.content,
            timestamp: now,
            tokens_used: new_msg.tokens_used,
        })
    }

    pub fn create_with_id(conn: &Connection, new_msg: NewMessageWithId) -> Result<Self> {
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, timestamp, tokens_used) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&new_msg.id, &new_msg.conversation_id, &new_msg.role, &new_msg.content, new_msg.timestamp, new_msg.tokens_used],
        )?;
        Ok(Message {
            id: new_msg.id,
            conversation_id: new_msg.conversation_id,
            role: new_msg.role,
            content: new_msg.content,
            timestamp: new_msg.timestamp,
            tokens_used: new_msg.tokens_used,
        })
    }

    pub fn get_by_conversation(conn: &Connection, conversation_id: &str) -> Result<Vec<Self>> {
        // Only return non-deleted messages
        let mut stmt = conn.prepare("SELECT id, conversation_id, role, content, timestamp, tokens_used FROM messages WHERE conversation_id = ?1 AND deleted = 0 ORDER BY timestamp ASC")?;
        let messages = stmt.query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tokens_used: row.get(5)?,
            })
        })?;
        messages.collect()
    }

    pub fn get_last_n(conn: &Connection, conversation_id: &str, n: i64) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare("SELECT id, conversation_id, role, content, timestamp, tokens_used FROM messages WHERE conversation_id = ?1 AND deleted = 0 ORDER BY timestamp DESC LIMIT ?2")?;
        let messages = stmt.query_map(params![conversation_id, n], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tokens_used: row.get(5)?,
            })
        })?;
        let mut result: Vec<Self> = messages.collect::<Result<Vec<_>>>()?;
        result.reverse();
        Ok(result)
    }

    pub fn search(conn: &Connection, query: &str, limit: i64) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare("SELECT m.id, m.conversation_id, m.role, m.content, m.timestamp, m.tokens_used FROM messages m JOIN messages_fts fts ON m.rowid = fts.rowid WHERE messages_fts MATCH ?1 AND m.deleted = 0 ORDER BY m.timestamp DESC LIMIT ?2")?;
        let messages = stmt.query_map(params![query, limit], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tokens_used: row.get(5)?,
            })
        })?;
        messages.collect()
    }

    pub fn update(conn: &Connection, id: &str, content: &str) -> Result<Self> {
        // Update message content
        conn.execute(
            "UPDATE messages SET content = ?1 WHERE id = ?2",
            params![content, id],
        )?;

        // Get the updated message
        let mut stmt = conn.prepare("SELECT id, conversation_id, role, content, timestamp, tokens_used FROM messages WHERE id = ?1")?;
        let message = stmt.query_row(params![id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                tokens_used: row.get(5)?,
            })
        })?;

        // Touch the conversation to update its timestamp
        super::conversations::Conversation::touch(conn, &message.conversation_id)?;

        Ok(message)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        // Soft-delete message by marking deleted flag
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        conn.execute(
            "UPDATE messages SET deleted = 1, deleted_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn get_conversation_token_count(conn: &Connection, conversation_id: &str) -> Result<i64> {
        let count: Option<i64> = conn.query_row(
            "SELECT SUM(tokens_used) FROM messages WHERE conversation_id = ?1",
            params![conversation_id],
            |row| row.get(0),
        )?;
        Ok(count.unwrap_or(0))
    }
}
