use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewTag {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationTag {
    pub conversation_id: String,
    pub tag_id: String,
    pub created_at: i64,
}

impl Tag {
    pub fn create(conn: &Connection, new_tag: NewTag) -> Result<Self> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO tags (id, name, color, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![&id, &new_tag.name, &new_tag.color, now, now],
        )?;

        Ok(Tag {
            id,
            name: new_tag.name,
            color: new_tag.color,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Self>> {
        let mut stmt =
            conn.prepare("SELECT id, name, color, created_at, updated_at FROM tags WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_by_name(conn: &Connection, name: &str) -> Result<Option<Self>> {
        let mut stmt = conn
            .prepare("SELECT id, name, color, created_at, updated_at FROM tags WHERE name = ?1")?;
        let mut rows = stmt.query(params![name])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_all(conn: &Connection) -> Result<Vec<Self>> {
        let mut stmt =
            conn.prepare("SELECT id, name, color, created_at, updated_at FROM tags ORDER BY name")?;
        let tags = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        tags.collect()
    }

    pub fn search(conn: &Connection, query: &str) -> Result<Vec<Self>> {
        let search_pattern = format!("%{}%", query);
        let mut stmt = conn.prepare("SELECT id, name, color, created_at, updated_at FROM tags WHERE name LIKE ?1 ORDER BY name")?;
        let tags = stmt.query_map(params![search_pattern], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        tags.collect()
    }

    pub fn update(conn: &Connection, id: &str, name: &str, color: Option<&str>) -> Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        conn.execute(
            "UPDATE tags SET name = ?1, color = ?2, updated_at = ?3 WHERE id = ?4",
            params![name, color, now, id],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        // First remove all conversation associations
        conn.execute(
            "DELETE FROM conversation_tags WHERE tag_id = ?1",
            params![id],
        )?;

        // Then delete the tag
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Get tags for a specific conversation
    pub fn get_for_conversation(conn: &Connection, conversation_id: &str) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color, t.created_at, t.updated_at 
             FROM tags t
             JOIN conversation_tags ct ON t.id = ct.tag_id
             WHERE ct.conversation_id = ?1
             ORDER BY t.name",
        )?;
        let tags = stmt.query_map(params![conversation_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        tags.collect()
    }

    // Add tag to conversation
    pub fn add_to_conversation(
        conn: &Connection,
        conversation_id: &str,
        tag_id: &str,
    ) -> Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        conn.execute(
            "INSERT OR IGNORE INTO conversation_tags (conversation_id, tag_id, created_at)
             VALUES (?1, ?2, ?3)",
            params![conversation_id, tag_id, now],
        )?;
        Ok(())
    }

    // Remove tag from conversation
    pub fn remove_from_conversation(
        conn: &Connection,
        conversation_id: &str,
        tag_id: &str,
    ) -> Result<()> {
        conn.execute(
            "DELETE FROM conversation_tags WHERE conversation_id = ?1 AND tag_id = ?2",
            params![conversation_id, tag_id],
        )?;
        Ok(())
    }

    // Get conversations by tag
    pub fn get_conversations_with_tag(conn: &Connection, tag_id: &str) -> Result<Vec<String>> {
        let mut stmt =
            conn.prepare("SELECT conversation_id FROM conversation_tags WHERE tag_id = ?1")?;
        let conversation_ids =
            stmt.query_map(params![tag_id], |row| Ok(row.get::<_, String>(0)?))?;
        conversation_ids.collect()
    }

    // Create or get existing tag by name
    pub fn create_or_get(conn: &Connection, name: &str, color: Option<&str>) -> Result<Self> {
        if let Some(existing) = Self::get_by_name(conn, name)? {
            Ok(existing)
        } else {
            Self::create(
                conn,
                NewTag {
                    name: name.to_string(),
                    color: color.map(|c| c.to_string()),
                },
            )
        }
    }
}
