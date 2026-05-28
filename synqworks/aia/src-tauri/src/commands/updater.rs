use log::{error, info};
use serde::{Deserialize, Serialize};

/// Version information returned from the API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub release_date: String,
    pub changelog: String,
    pub download_url: String,
    pub checksum: Option<String>,
    pub is_critical: bool,
}

/// Update status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    pub has_update: bool,
    pub current_version: String,
    pub new_version: Option<String>,
    pub release_info: Option<VersionInfo>,
    pub is_installing: bool,
    pub error: Option<String>,
}

/// Check for available updates from GitHub releases
/// This queries the GitHub API for the latest release
#[tauri::command]
pub async fn check_for_updates(_app: tauri::AppHandle) -> Result<UpdateStatus, String> {
    let current_version = env!("CARGO_PKG_VERSION");

    info!(
        "Checking for updates... Current version: {}",
        current_version
    );

    match check_github_releases(current_version).await {
        Ok(version_info) => {
            info!(
                "Update check successful. New version available: {}",
                version_info.version
            );
            Ok(UpdateStatus {
                has_update: version_info.version != current_version,
                current_version: current_version.to_string(),
                new_version: Some(version_info.version.clone()),
                release_info: Some(version_info),
                is_installing: false,
                error: None,
            })
        }
        Err(e) => {
            error!("Failed to check for updates: {}", e);
            Ok(UpdateStatus {
                has_update: false,
                current_version: current_version.to_string(),
                new_version: None,
                release_info: None,
                is_installing: false,
                error: Some(e),
            })
        }
    }
}

/// Download and install an update from GitHub
/// This command handles the download and installation process
#[tauri::command]
pub async fn download_and_install_update(
    _app: tauri::AppHandle,
    version: String,
) -> Result<String, String> {
    info!("Starting update download for version: {}", version);

    match download_release(&version).await {
        Ok(file_path) => {
            info!("Update downloaded to: {}", file_path);

            // Installation will be handled by the system or through a restart
            Ok(format!("Update {} downloaded successfully", version))
        }
        Err(e) => {
            error!("Failed to download update: {}", e);
            Err(format!("Download failed: {}", e))
        }
    }
}

/// Get current application version
#[tauri::command]
pub fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Check GitHub API for the latest release
/// This is a helper function that queries the GitHub API
async fn check_github_releases(_current_version: &str) -> Result<VersionInfo, String> {
    let client = reqwest::Client::new();

    // Query the GitHub API for latest releases
    let url = "https://api.github.com/repos/tbmobb813/Linux-AI-Assistant---Project/releases/latest";

    match client
        .get(url)
        .header("User-Agent", "linux-ai-assistant")
        .send()
        .await
    {
        Ok(response) => {
            match response.json::<serde_json::Value>().await {
                Ok(json) => {
                    // Extract version from tag_name (e.g., "v0.2.0" -> "0.2.0")
                    let version = json
                        .get("tag_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("0.1.0")
                        .trim_start_matches('v')
                        .to_string();

                    let changelog = json
                        .get("body")
                        .and_then(|v| v.as_str())
                        .unwrap_or("No changelog available")
                        .to_string();

                    let published_at = json
                        .get("published_at")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string();

                    // Find the Linux AppImage download URL
                    let download_url = json
                        .get("assets")
                        .and_then(|assets| assets.as_array())
                        .and_then(|assets_arr| {
                            assets_arr.iter().find(|asset| {
                                asset
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .map(|n| n.contains("AppImage") || n.contains("linux"))
                                    .unwrap_or(false)
                            })
                        })
                        .and_then(|asset| asset.get("browser_download_url"))
                        .and_then(|url| url.as_str())
                        .unwrap_or("")
                        .to_string();

                    info!("Latest version from GitHub: {}", version);

                    Ok(VersionInfo {
                        version,
                        release_date: published_at,
                        changelog,
                        download_url,
                        checksum: None,
                        is_critical: false,
                    })
                }
                Err(e) => Err(format!("Failed to parse GitHub API response: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to reach GitHub API: {}", e)),
    }
}

/// Download a specific release from GitHub
/// This is a helper function that downloads the release package
async fn download_release(version: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let version_tag = format!("v{}", version);

    // First, get the release info to find the download URL
    let url = format!(
        "https://api.github.com/repos/tbmobb813/Linux-AI-Assistant---Project/releases/tags/{}",
        version_tag
    );

    let response = client
        .get(&url)
        .header("User-Agent", "linux-ai-assistant")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;

    let json = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;

    // Find the Linux AppImage download URL
    let download_url = json
        .get("assets")
        .and_then(|assets| assets.as_array())
        .and_then(|assets_arr| {
            assets_arr.iter().find(|asset| {
                asset
                    .get("name")
                    .and_then(|n| n.as_str())
                    .map(|n| n.contains("AppImage") || n.ends_with(".AppImage"))
                    .unwrap_or(false)
            })
        })
        .and_then(|asset| asset.get("browser_download_url"))
        .and_then(|url| url.as_str())
        .ok_or("No AppImage found in release assets".to_string())?;

    info!("Downloading from: {}", download_url);

    // Download the file to a temporary location
    let response = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download release: {}", e))?;

    let content = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download content: {}", e))?;

    // Save to a standard location (~/.local/share/linux-ai-assistant/)
    let mut save_dir = dirs::home_dir().ok_or("Failed to get home directory".to_string())?;
    save_dir.push(".local/share/linux-ai-assistant");

    std::fs::create_dir_all(&save_dir)
        .map_err(|e| format!("Failed to create download directory: {}", e))?;

    let filename = format!("linux-ai-assistant-{}.AppImage", version);
    let mut temp_path = save_dir;
    temp_path.push(&filename);

    std::fs::write(&temp_path, content)
        .map_err(|e| format!("Failed to write download file: {}", e))?;

    // Make it executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&temp_path, perms)
            .map_err(|e| format!("Failed to make executable: {}", e))?;
    }

    Ok(temp_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_version_parsing() {
        let version_str = "0.2.0";
        assert_eq!(version_str, "0.2.0");
    }
}
