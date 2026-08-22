use serde::Serialize;
use std::process::Command;

#[derive(Serialize, Clone)]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct GitContext {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub dirty: bool,
    pub uncommitted_changes: usize,
    pub recent_commits: Vec<GitCommit>,
    pub remote_url: Option<String>,
}

/// Get comprehensive git context for a given path (defaults to current working directory).
/// Returns JSON with { is_repo, branch, dirty, uncommitted_changes, recent_commits, remote_url }.
#[tauri::command]
pub async fn get_git_context(path: Option<String>) -> Result<GitContext, String> {
    let cwd = path.unwrap_or_else(|| String::from("."));

    // Check if inside a git work tree
    let inside = Command::new("git")
        .arg("-C")
        .arg(&cwd)
        .arg("rev-parse")
        .arg("--is-inside-work-tree")
        .output()
        .map_err(|e| format!("failed to run git: {}", e))?;

    if !inside.status.success() {
        return Ok(GitContext {
            is_repo: false,
            branch: None,
            dirty: false,
            uncommitted_changes: 0,
            recent_commits: Vec::new(),
            remote_url: None,
        });
    }

    // Get current branch
    let branch_out = Command::new("git")
        .arg("-C")
        .arg(&cwd)
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .output()
        .map_err(|e| format!("failed to run git: {}", e))?;

    let branch = if branch_out.status.success() {
        let s = String::from_utf8_lossy(&branch_out.stdout)
            .trim()
            .to_string();
        Some(s)
    } else {
        None
    };

    // Check for uncommitted changes and count them
    let status_out = Command::new("git")
        .arg("-C")
        .arg(&cwd)
        .arg("status")
        .arg("--porcelain")
        .output()
        .map_err(|e| format!("failed to run git: {}", e))?;

    let (dirty, uncommitted_changes) = if status_out.status.success() {
        let output_str = String::from_utf8_lossy(&status_out.stdout).to_string();
        let lines: Vec<&str> = output_str.lines().filter(|line| !line.is_empty()).collect();
        let count = lines.len();
        (!status_out.stdout.is_empty(), count)
    } else {
        (false, 0)
    };

    // Get recent commits
    let commits_out = Command::new("git")
        .arg("-C")
        .arg(&cwd)
        .arg("log")
        .arg("-5")
        .arg("--pretty=format:%H%x00%an%x00%ar%x00%s")
        .output()
        .map_err(|e| format!("failed to run git log: {}", e))?;

    let recent_commits = if commits_out.status.success() {
        String::from_utf8_lossy(&commits_out.stdout)
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('\0').collect();
                if parts.len() >= 4 {
                    Some(GitCommit {
                        hash: parts[0].to_string(),
                        author: parts[1].to_string(),
                        date: parts[2].to_string(),
                        message: parts[3].to_string(),
                    })
                } else {
                    None
                }
            })
            .collect()
    } else {
        Vec::new()
    };

    // Get remote URL
    let remote_out = Command::new("git")
        .arg("-C")
        .arg(&cwd)
        .arg("config")
        .arg("--get")
        .arg("remote.origin.url")
        .output()
        .ok();

    let remote_url = remote_out.and_then(|output| {
        if output.status.success() {
            Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            None
        }
    });

    Ok(GitContext {
        is_repo: true,
        branch,
        dirty,
        uncommitted_changes,
        recent_commits,
        remote_url,
    })
}

/// Format git context as human-readable text for AI consumption
#[tauri::command]
pub async fn format_git_context(path: Option<String>) -> Result<String, String> {
    let context = get_git_context(path).await?;

    if !context.is_repo {
        return Ok(String::from("Not a git repository"));
    }

    let mut output = String::new();

    if let Some(branch) = &context.branch {
        output.push_str(&format!("📍 Branch: {}\n", branch));
    }

    if context.uncommitted_changes > 0 {
        output.push_str(&format!(
            "⚠️  Uncommitted changes: {} file{}\n",
            context.uncommitted_changes,
            if context.uncommitted_changes == 1 {
                ""
            } else {
                "s"
            }
        ));
    } else {
        output.push_str("✅ Working directory clean\n");
    }

    if let Some(remote) = &context.remote_url {
        output.push_str(&format!("🔗 Remote: {}\n", remote));
    }

    if !context.recent_commits.is_empty() {
        output.push_str("\n📜 Recent commits:\n");
        for commit in &context.recent_commits {
            let short_hash = &commit.hash[..8.min(commit.hash.len())];
            let first_line = commit.message.lines().next().unwrap_or("");
            output.push_str(&format!(
                "  {} - {} ({}, {})\n",
                short_hash, first_line, commit.author, commit.date
            ));
        }
    }

    Ok(output)
}
