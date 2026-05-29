use log::{error, info};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseStatus {
    pub tier: String,
    pub status: String,
    pub customer_email: Option<String>,
    pub activations_remaining: Option<i64>,
    pub verified_at: Option<String>,
    pub expires_grace_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivateResult {
    pub tier: String,
    pub status: String,
    pub activations_remaining: Option<i64>,
}

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("licenses.db"))
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}

fn open_db(path: &PathBuf) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create license DB directory: {}", e))?;
    }
    let conn = Connection::open(path).map_err(|e| format!("Failed to open license DB: {}", e))?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS licenses (
            key TEXT PRIMARY KEY,
            tier TEXT NOT NULL DEFAULT 'trial',
            status TEXT NOT NULL DEFAULT 'inactive',
            customer_email TEXT,
            activations_remaining INTEGER,
            verified_at TEXT NOT NULL,
            expires_grace_at TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("Failed to init license table: {}", e))?;
    Ok(conn)
}

/// Returns the current license status from local SQLite cache.
/// Falls back to 'trial' if no valid row exists or the grace period has expired.
#[tauri::command]
pub async fn get_license_status(app: tauri::AppHandle) -> Result<LicenseStatus, String> {
    let path = db_path(&app)?;
    let conn = open_db(&path)?;

    let result = conn.query_row(
        "SELECT key, tier, status, customer_email, activations_remaining, verified_at, expires_grace_at \
         FROM licenses ORDER BY verified_at DESC LIMIT 1",
        [],
        |row| {
            Ok(LicenseStatus {
                tier: row.get(1)?,
                status: row.get(2)?,
                customer_email: row.get(3)?,
                activations_remaining: row.get(4)?,
                verified_at: row.get(5)?,
                expires_grace_at: row.get(6)?,
            })
        },
    );

    match result {
        Ok(mut status) => {
            // Enforce grace period: if expired, downgrade to trial
            if let Some(ref expires) = status.expires_grace_at {
                if expires.as_str() < chrono::Utc::now().to_rfc3339().as_str() {
                    info!("License grace period expired, downgrading to trial");
                    status.tier = "trial".to_string();
                    status.status = "expired".to_string();
                }
            }
            Ok(status)
        }
        Err(_) => Ok(LicenseStatus {
            tier: "trial".to_string(),
            status: "inactive".to_string(),
            customer_email: None,
            activations_remaining: None,
            verified_at: None,
            expires_grace_at: None,
        }),
    }
}

/// Validates a license key against the command-center API (which proxies LemonSqueezy).
/// On success, stores the result locally with a 7-day grace period.
#[tauri::command]
pub async fn verify_license(
    app: tauri::AppHandle,
    key: String,
) -> Result<ActivateResult, String> {
    if key.trim().is_empty() {
        return Err("License key cannot be empty".to_string());
    }

    info!("Verifying license key: {}...", &key[..key.len().min(8)]);

    let client = reqwest::Client::new();

    // Call the local command-center API which proxies LemonSqueezy
    let response = client
        .post("http://localhost:3002/api/license/activate")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "key": key.trim() }))
        .send()
        .await
        .map_err(|e| format!("Failed to reach command-center API: {}", e))?;

    let status_code = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse activation response: {}", e))?;

    if !status_code.is_success() {
        let msg = body
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Activation failed")
            .to_string();
        return Err(msg);
    }

    let tier = body
        .get("tier")
        .and_then(|v| v.as_str())
        .unwrap_or("trial")
        .to_string();
    let activation_status = body
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("active")
        .to_string();
    let activations_remaining = body
        .get("activationsRemaining")
        .and_then(|v| v.as_i64());

    info!("License activated: tier={}, status={}", tier, activation_status);

    // Persist to local SQLite with 7-day grace period
    let now = chrono::Utc::now();
    let expires = now + chrono::Duration::days(7);
    let path = db_path(&app)?;
    let conn = open_db(&path)?;

    conn.execute(
        "INSERT INTO licenses (key, tier, status, activations_remaining, verified_at, expires_grace_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6) \
         ON CONFLICT(key) DO UPDATE SET \
           tier=excluded.tier, status=excluded.status, \
           activations_remaining=excluded.activations_remaining, \
           verified_at=excluded.verified_at, expires_grace_at=excluded.expires_grace_at",
        params![
            key.trim(),
            tier,
            activation_status,
            activations_remaining,
            now.to_rfc3339(),
            expires.to_rfc3339(),
        ],
    )
    .map_err(|e| {
        error!("Failed to save license: {}", e);
        format!("Failed to save license locally: {}", e)
    })?;

    Ok(ActivateResult {
        tier,
        status: activation_status,
        activations_remaining,
    })
}
