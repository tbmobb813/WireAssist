use rusqlite::{params, Connection, Result, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub default_model: String,
    pub default_provider: String,
    pub system_prompt: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewProfile {
    pub name: String,
    pub description: Option<String>,
    pub default_model: String,
    pub default_provider: String,
    pub system_prompt: Option<String>,
}

impl Profile {
    fn from_row(row: &Row) -> Result<Self> {
        Ok(Profile {
            id: row.get("id")?,
            name: row.get("name")?,
            description: row.get("description")?,
            default_model: row.get("default_model")?,
            default_provider: row.get("default_provider")?,
            system_prompt: row.get("system_prompt")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            is_active: row.get::<_, i64>("is_active")? == 1,
        })
    }

    pub fn create(conn: &Connection, new_profile: NewProfile) -> Result<Self> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();

        conn.execute(
            "INSERT INTO profiles (id, name, description, default_model, default_provider, system_prompt, created_at, updated_at, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)",
            params![
                id,
                new_profile.name,
                new_profile.description,
                new_profile.default_model,
                new_profile.default_provider,
                new_profile.system_prompt,
                now,
                now
            ],
        )?;

        Self::get_by_id(conn, &id)?.ok_or_else(|| {
            rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_FAIL),
                Some("Failed to retrieve created profile".to_string()),
            )
        })
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, default_model, default_provider, system_prompt, created_at, updated_at, is_active
             FROM profiles
             WHERE id = ?1"
        )?;

        let mut rows = stmt.query_map([id], Self::from_row)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn get_all(conn: &Connection) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, default_model, default_provider, system_prompt, created_at, updated_at, is_active
             FROM profiles
             ORDER BY is_active DESC, updated_at DESC"
        )?;

        let profile_iter = stmt.query_map([], Self::from_row)?;
        let mut profiles = Vec::new();
        for profile in profile_iter {
            profiles.push(profile?);
        }
        Ok(profiles)
    }

    pub fn get_active(conn: &Connection) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, default_model, default_provider, system_prompt, created_at, updated_at, is_active
             FROM profiles
             WHERE is_active = 1
             LIMIT 1"
        )?;

        let mut rows = stmt.query_map([], Self::from_row)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn set_active(conn: &Connection, id: &str) -> Result<()> {
        // First, deactivate all profiles
        conn.execute("UPDATE profiles SET is_active = 0", [])?;

        // Then activate the specified profile
        let updated = conn.execute(
            "UPDATE profiles SET is_active = 1, updated_at = ?1 WHERE id = ?2",
            params![chrono::Utc::now().timestamp_millis(), id],
        )?;

        if updated == 0 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_FAIL),
                Some("Profile not found".to_string()),
            ));
        }

        Ok(())
    }

    pub fn update(conn: &Connection, id: &str, updates: NewProfile) -> Result<Self> {
        let now = chrono::Utc::now().timestamp_millis();

        let updated = conn.execute(
            "UPDATE profiles
             SET name = ?1, description = ?2, default_model = ?3, default_provider = ?4,
                 system_prompt = ?5, updated_at = ?6
             WHERE id = ?7",
            params![
                updates.name,
                updates.description,
                updates.default_model,
                updates.default_provider,
                updates.system_prompt,
                now,
                id
            ],
        )?;

        if updated == 0 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_FAIL),
                Some("Profile not found".to_string()),
            ));
        }

        Self::get_by_id(conn, id)?.ok_or_else(|| {
            rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_FAIL),
                Some("Failed to retrieve updated profile".to_string()),
            )
        })
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        // Don't allow deleting the last profile
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM profiles", [], |row| row.get(0))?;
        if count <= 1 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                Some("Cannot delete the last profile".to_string()),
            ));
        }

        let was_active: bool = conn.query_row(
            "SELECT is_active FROM profiles WHERE id = ?1",
            [id],
            |row| Ok(row.get::<_, i64>(0)? == 1),
        )?;

        let deleted = conn.execute("DELETE FROM profiles WHERE id = ?1", [id])?;

        if deleted == 0 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_FAIL),
                Some("Profile not found".to_string()),
            ));
        }

        // If we deleted the active profile, make the first remaining profile active
        if was_active {
            conn.execute(
                "UPDATE profiles SET is_active = 1, updated_at = ?1
                 WHERE id = (SELECT id FROM profiles ORDER BY updated_at DESC LIMIT 1)",
                [chrono::Utc::now().timestamp_millis()],
            )?;
        }

        Ok(())
    }
}
