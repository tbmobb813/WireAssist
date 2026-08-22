use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitContext {
    pub is_repo: bool,
    pub current_branch: Option<String>,
    pub uncommitted_changes: usize,
    pub recent_commits: Vec<GitCommit>,
    pub remote_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

impl GitContext {
    /// Get git context for the given directory
    pub fn from_path(path: &Path) -> Self {
        if !is_git_repo(path) {
            return Self::empty();
        }

        let current_branch = get_current_branch(path);
        let uncommitted_changes = count_uncommitted_changes(path);
        let recent_commits = get_recent_commits(path, 5);
        let remote_url = get_remote_url(path);

        GitContext {
            is_repo: true,
            current_branch,
            uncommitted_changes,
            recent_commits,
            remote_url,
        }
    }

    fn empty() -> Self {
        GitContext {
            is_repo: false,
            current_branch: None,
            uncommitted_changes: 0,
            recent_commits: Vec::new(),
            remote_url: None,
        }
    }

    /// Format context as a human-readable string for AI prompts
    pub fn format_for_ai(&self) -> String {
        if !self.is_repo {
            return String::from("Not a git repository");
        }

        let mut output = String::new();

        if let Some(branch) = &self.current_branch {
            output.push_str(&format!("Branch: {}\n", branch));
        }

        if self.uncommitted_changes > 0 {
            output.push_str(&format!(
                "Uncommitted changes: {} files\n",
                self.uncommitted_changes
            ));
        }

        if !self.recent_commits.is_empty() {
            output.push_str("\nRecent commits:\n");
            for commit in &self.recent_commits {
                output.push_str(&format!(
                    "  {} - {} ({})\n",
                    &commit.hash[..8],
                    commit.message.lines().next().unwrap_or(""),
                    commit.author
                ));
            }
        }

        output
    }
}

fn is_git_repo(path: &Path) -> bool {
    let output = Command::new("git")
        .arg("rev-parse")
        .arg("--git-dir")
        .current_dir(path)
        .output();

    matches!(output, Ok(output) if output.status.success())
}

fn get_current_branch(path: &Path) -> Option<String> {
    let output = Command::new("git")
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .current_dir(path)
        .output()
        .ok()?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .ok()
            .map(|s| s.trim().to_string())
    } else {
        None
    }
}

fn count_uncommitted_changes(path: &Path) -> usize {
    let output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(path)
        .output();

    match output {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter(|line| !line.is_empty())
            .count(),
        _ => 0,
    }
}

fn get_recent_commits(path: &Path, count: usize) -> Vec<GitCommit> {
    let output = Command::new("git")
        .arg("log")
        .arg(format!("-{}", count))
        .arg("--pretty=format:%H%x00%an%x00%ad%x00%s")
        .arg("--date=relative")
        .current_dir(path)
        .output();

    match output {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout)
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
            .collect(),
        _ => Vec::new(),
    }
}

fn get_remote_url(path: &Path) -> Option<String> {
    let output = Command::new("git")
        .arg("config")
        .arg("--get")
        .arg("remote.origin.url")
        .current_dir(path)
        .output()
        .ok()?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .ok()
            .map(|s| s.trim().to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_git_context_from_current_repo() {
        // This should be run in a git repo
        let current_dir = env::current_dir().unwrap();
        let context = GitContext::from_path(&current_dir);

        // If we're in a git repo, these should be populated
        if context.is_repo {
            assert!(context.current_branch.is_some());
            println!("Branch: {:?}", context.current_branch);
            println!("Uncommitted: {}", context.uncommitted_changes);
            println!("Recent commits: {}", context.recent_commits.len());
        }
    }

    #[test]
    fn test_git_context_non_repo() {
        let context = GitContext::from_path(Path::new("/tmp"));
        assert!(!context.is_repo);
        assert!(context.current_branch.is_none());
        assert_eq!(context.uncommitted_changes, 0);
    }

    #[test]
    fn test_format_for_ai() {
        let context = GitContext {
            is_repo: true,
            current_branch: Some("main".to_string()),
            uncommitted_changes: 3,
            recent_commits: vec![GitCommit {
                hash: "abc123def456".to_string(),
                author: "Test User".to_string(),
                date: "2 hours ago".to_string(),
                message: "Fix bug in parser".to_string(),
            }],
            remote_url: Some("git@github.com:user/repo.git".to_string()),
        };

        let formatted = context.format_for_ai();
        assert!(formatted.contains("Branch: main"));
        assert!(formatted.contains("Uncommitted changes: 3"));
        assert!(formatted.contains("abc123de")); // First 8 chars of hash
    }
}
