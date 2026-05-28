use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceTemplate {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub default_model: String,
    pub default_provider: String,
    pub system_prompt: Option<String>,
    pub settings_json: Option<String>,
    pub ignore_patterns: Option<String>,
    pub file_extensions: Option<String>,
    pub context_instructions: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_builtin: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewWorkspaceTemplate {
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub default_model: String,
    pub default_provider: String,
    pub system_prompt: Option<String>,
    pub settings_json: Option<String>,
    pub ignore_patterns: Option<String>,
    pub file_extensions: Option<String>,
    pub context_instructions: Option<String>,
}

impl WorkspaceTemplate {
    pub fn create(conn: &Connection, new_template: NewWorkspaceTemplate) -> Result<Self> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO workspace_templates (
                id, name, description, category, default_model, default_provider,
                system_prompt, settings_json, ignore_patterns, file_extensions,
                context_instructions, created_at, updated_at, is_builtin
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 0)",
            params![
                &id,
                &new_template.name,
                &new_template.description,
                &new_template.category,
                &new_template.default_model,
                &new_template.default_provider,
                &new_template.system_prompt,
                &new_template.settings_json,
                &new_template.ignore_patterns,
                &new_template.file_extensions,
                &new_template.context_instructions,
                now,
                now
            ],
        )?;

        Ok(WorkspaceTemplate {
            id,
            name: new_template.name,
            description: new_template.description,
            category: new_template.category,
            default_model: new_template.default_model,
            default_provider: new_template.default_provider,
            system_prompt: new_template.system_prompt,
            settings_json: new_template.settings_json,
            ignore_patterns: new_template.ignore_patterns,
            file_extensions: new_template.file_extensions,
            context_instructions: new_template.context_instructions,
            created_at: now,
            updated_at: now,
            is_builtin: false,
        })
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, category, default_model, default_provider,
                    system_prompt, settings_json, ignore_patterns, file_extensions,
                    context_instructions, created_at, updated_at, is_builtin
             FROM workspace_templates WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(WorkspaceTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                default_model: row.get(4)?,
                default_provider: row.get(5)?,
                system_prompt: row.get(6)?,
                settings_json: row.get(7)?,
                ignore_patterns: row.get(8)?,
                file_extensions: row.get(9)?,
                context_instructions: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                is_builtin: row.get::<_, i64>(13)? == 1,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_all(conn: &Connection) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, category, default_model, default_provider,
                    system_prompt, settings_json, ignore_patterns, file_extensions,
                    context_instructions, created_at, updated_at, is_builtin
             FROM workspace_templates ORDER BY is_builtin DESC, category, name",
        )?;
        let templates = stmt.query_map([], |row| {
            Ok(WorkspaceTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                default_model: row.get(4)?,
                default_provider: row.get(5)?,
                system_prompt: row.get(6)?,
                settings_json: row.get(7)?,
                ignore_patterns: row.get(8)?,
                file_extensions: row.get(9)?,
                context_instructions: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                is_builtin: row.get::<_, i64>(13)? == 1,
            })
        })?;
        templates.collect()
    }

    pub fn get_by_category(conn: &Connection, category: &str) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, category, default_model, default_provider,
                    system_prompt, settings_json, ignore_patterns, file_extensions,
                    context_instructions, created_at, updated_at, is_builtin
             FROM workspace_templates WHERE category = ?1 ORDER BY is_builtin DESC, name",
        )?;
        let templates = stmt.query_map(params![category], |row| {
            Ok(WorkspaceTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                default_model: row.get(4)?,
                default_provider: row.get(5)?,
                system_prompt: row.get(6)?,
                settings_json: row.get(7)?,
                ignore_patterns: row.get(8)?,
                file_extensions: row.get(9)?,
                context_instructions: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                is_builtin: row.get::<_, i64>(13)? == 1,
            })
        })?;
        templates.collect()
    }

    pub fn get_categories(conn: &Connection) -> Result<Vec<String>> {
        let mut stmt =
            conn.prepare("SELECT DISTINCT category FROM workspace_templates ORDER BY category")?;
        let categories = stmt.query_map([], |row| Ok(row.get::<_, String>(0)?))?;
        categories.collect()
    }

    pub fn update(
        conn: &Connection,
        id: &str,
        updated_template: NewWorkspaceTemplate,
    ) -> Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        conn.execute(
            "UPDATE workspace_templates SET 
                name = ?1, description = ?2, category = ?3, default_model = ?4,
                default_provider = ?5, system_prompt = ?6, settings_json = ?7,
                ignore_patterns = ?8, file_extensions = ?9, context_instructions = ?10,
                updated_at = ?11
             WHERE id = ?12",
            params![
                &updated_template.name,
                &updated_template.description,
                &updated_template.category,
                &updated_template.default_model,
                &updated_template.default_provider,
                &updated_template.system_prompt,
                &updated_template.settings_json,
                &updated_template.ignore_patterns,
                &updated_template.file_extensions,
                &updated_template.context_instructions,
                now,
                id
            ],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<()> {
        // Only allow deletion of custom templates (not built-in ones)
        conn.execute(
            "DELETE FROM workspace_templates WHERE id = ?1 AND is_builtin = 0",
            params![id],
        )?;
        Ok(())
    }

    pub fn search(conn: &Connection, query: &str) -> Result<Vec<Self>> {
        let search_pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, name, description, category, default_model, default_provider,
                    system_prompt, settings_json, ignore_patterns, file_extensions,
                    context_instructions, created_at, updated_at, is_builtin
             FROM workspace_templates 
             WHERE name LIKE ?1 OR description LIKE ?1 OR category LIKE ?1
             ORDER BY is_builtin DESC, name",
        )?;
        let templates = stmt.query_map(params![search_pattern], |row| {
            Ok(WorkspaceTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                default_model: row.get(4)?,
                default_provider: row.get(5)?,
                system_prompt: row.get(6)?,
                settings_json: row.get(7)?,
                ignore_patterns: row.get(8)?,
                file_extensions: row.get(9)?,
                context_instructions: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                is_builtin: row.get::<_, i64>(13)? == 1,
            })
        })?;
        templates.collect()
    }
}
