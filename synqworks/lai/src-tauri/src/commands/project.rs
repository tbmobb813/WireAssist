use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{mpsc, Mutex, OnceLock};
use tauri::Emitter;

static WATCHER: OnceLock<Mutex<Option<RecommendedWatcher>>> = OnceLock::new();
static IGNORE_PATTERNS: OnceLock<Mutex<Option<Gitignore>>> = OnceLock::new();

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileMatch {
    pub path: String,
    pub line_number: Option<usize>,
    pub line_content: Option<String>,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
    pub file_type: String,
    pub score: f32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchResult {
    pub query: String,
    pub matches: Vec<FileMatch>,
    pub total_files_searched: usize,
    pub search_time_ms: u64,
}

fn build_gitignore(patterns: &[String], root: &PathBuf) -> Result<Gitignore, String> {
    let mut builder = GitignoreBuilder::new(root);

    // Add provided patterns
    for pattern in patterns {
        builder
            .add_line(None, pattern)
            .map_err(|e| format!("Invalid pattern '{}': {}", pattern, e))?;
    }

    // Try to add existing .gitignore files
    let gitignore_path = root.join(".gitignore");
    if gitignore_path.exists() {
        builder.add(&gitignore_path);
    }

    builder
        .build()
        .map_err(|e| format!("Failed to build gitignore: {}", e))
}

fn should_ignore_path(path: &PathBuf, root: &PathBuf) -> bool {
    let ignore_cell = IGNORE_PATTERNS.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = ignore_cell.lock() {
        if let Some(ref gitignore) = *guard {
            // Get relative path from project root
            if let Ok(relative_path) = path.strip_prefix(root) {
                return gitignore.matched(relative_path, path.is_dir()).is_ignore();
            }
        }
    }
    false
}

fn get_file_type(path: &PathBuf) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("unknown")
        .to_lowercase()
}

fn is_text_file(file_type: &str) -> bool {
    matches!(
        file_type,
        "txt"
            | "md"
            | "rs"
            | "js"
            | "ts"
            | "tsx"
            | "jsx"
            | "py"
            | "java"
            | "c"
            | "cpp"
            | "h"
            | "hpp"
            | "css"
            | "scss"
            | "sass"
            | "html"
            | "htm"
            | "xml"
            | "json"
            | "yaml"
            | "yml"
            | "toml"
            | "ini"
            | "cfg"
            | "conf"
            | "sh"
            | "bash"
            | "zsh"
            | "fish"
            | "ps1"
            | "bat"
            | "cmd"
            | "sql"
            | "go"
            | "php"
            | "rb"
            | "swift"
            | "kt"
            | "scala"
            | "clj"
            | "hs"
            | "ml"
            | "r"
            | "dockerfile"
            | "makefile"
            | "gradle"
            | "cmake"
            | "lock"
            | "sum"
            | "mod"
            | "gitignore"
            | "gitattributes"
            | "editorconfig"
            | "env"
            | "example"
            | "sample"
            | "template"
            | "log"
            | "csv"
            | "tsv"
            | "properties"
            | "lua"
            | "vim"
            | "vimrc"
            | "zshrc"
            | "bashrc"
    )
}

fn search_file_content(path: &PathBuf, query: &str, case_sensitive: bool) -> Vec<FileMatch> {
    let mut matches = Vec::new();

    if let Ok(content) = fs::read_to_string(path) {
        let lines: Vec<&str> = content.lines().collect();
        let search_query = if case_sensitive {
            query.to_string()
        } else {
            query.to_lowercase()
        };

        for (line_num, line) in lines.iter().enumerate() {
            let search_line = if case_sensitive {
                line.to_string()
            } else {
                line.to_lowercase()
            };

            if search_line.contains(&search_query) {
                let context_before: Vec<String> = lines
                    .iter()
                    .skip(line_num.saturating_sub(2))
                    .take(2)
                    .map(|s| s.to_string())
                    .collect();

                let context_after: Vec<String> = lines
                    .iter()
                    .skip(line_num + 1)
                    .take(2)
                    .map(|s| s.to_string())
                    .collect();

                // Simple scoring: exact matches get higher scores
                let score = if line.eq_ignore_ascii_case(query) {
                    1.0
                } else if line.to_lowercase().contains(&query.to_lowercase()) {
                    0.8
                } else {
                    0.5
                };

                matches.push(FileMatch {
                    path: path.to_string_lossy().to_string(),
                    line_number: Some(line_num + 1),
                    line_content: Some(line.to_string()),
                    context_before,
                    context_after,
                    file_type: get_file_type(path),
                    score,
                });
            }
        }
    }

    matches
}

fn walk_directory(
    root: &PathBuf,
    query: &str,
    case_sensitive: bool,
    max_results: usize,
) -> Result<SearchResult, String> {
    let start_time = std::time::Instant::now();
    let mut all_matches = Vec::new();
    let mut files_searched = 0;

    fn visit_dir(
        dir: &PathBuf,
        root: &PathBuf,
        query: &str,
        case_sensitive: bool,
        matches: &mut Vec<FileMatch>,
        files_searched: &mut usize,
        max_results: usize,
    ) -> Result<(), String> {
        if matches.len() >= max_results {
            return Ok(());
        }

        let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries {
            if matches.len() >= max_results {
                break;
            }

            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();

            // Skip ignored paths
            if should_ignore_path(&path, root) {
                continue;
            }

            if path.is_dir() {
                visit_dir(
                    &path,
                    root,
                    query,
                    case_sensitive,
                    matches,
                    files_searched,
                    max_results,
                )?;
            } else if path.is_file() {
                let file_type = get_file_type(&path);

                // Search filename
                let filename = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");

                let search_filename = if case_sensitive {
                    filename.to_string()
                } else {
                    filename.to_lowercase()
                };
                let search_query = if case_sensitive {
                    query.to_string()
                } else {
                    query.to_lowercase()
                };

                if search_filename.contains(&search_query) {
                    matches.push(FileMatch {
                        path: path.to_string_lossy().to_string(),
                        line_number: None,
                        line_content: None,
                        context_before: vec![],
                        context_after: vec![],
                        file_type: file_type.clone(),
                        score: if search_filename == search_query {
                            1.0
                        } else {
                            0.9
                        },
                    });
                }

                // Search file content if it's a text file
                if is_text_file(&file_type) {
                    let content_matches = search_file_content(&path, query, case_sensitive);
                    matches.extend(content_matches);
                    *files_searched += 1;
                }
            }
        }

        Ok(())
    }

    visit_dir(
        root,
        root,
        query,
        case_sensitive,
        &mut all_matches,
        &mut files_searched,
        max_results,
    )?;

    // Sort by score (highest first) and take top results
    all_matches.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    all_matches.truncate(max_results);

    let search_time = start_time.elapsed().as_millis() as u64;

    Ok(SearchResult {
        query: query.to_string(),
        matches: all_matches,
        total_files_searched: files_searched,
        search_time_ms: search_time,
    })
}

#[tauri::command]
pub fn set_project_root(
    path: String,
    patterns: Option<Vec<String>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let root = PathBuf::from(path);
    if !root.exists() || !root.is_dir() {
        return Err("path does not exist or is not a directory".into());
    }

    // Default ignore patterns if none provided
    let ignore_patterns = patterns.unwrap_or_else(|| {
        vec![
            "node_modules/**".to_string(),
            ".git/**".to_string(),
            "target/**".to_string(),
            "dist/**".to_string(),
            "build/**".to_string(),
            "*.log".to_string(),
            ".DS_Store".to_string(),
            "Thumbs.db".to_string(),
        ]
    });

    // Build gitignore patterns
    let gitignore = build_gitignore(&ignore_patterns, &root)?;

    // Store ignore patterns
    let ignore_cell = IGNORE_PATTERNS.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = ignore_cell.lock() {
        *guard = Some(gitignore);
    }

    // Stop existing watcher
    if let Some(cell) = WATCHER.get() {
        if let Ok(mut guard) = cell.lock() {
            if let Some(_w) = guard.take() {
                // Dropping here stops the previous watcher completely
            }
        }
    }

    let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|e| format!("watcher init failed: {}", e))?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| format!("watch path failed: {}", e))?;

    // store watcher
    let _ = WATCHER.get_or_init(|| Mutex::new(None));
    if let Some(cell) = WATCHER.get() {
        if let Ok(mut guard) = cell.lock() {
            *guard = Some(watcher);
        }
    }

    // spawn receiver thread emitting events
    let app_handle = app.clone();
    let project_root = root.clone();
    std::thread::spawn(move || {
        while let Ok(ev) = rx.recv() {
            if let Ok(event) = ev {
                let paths: Vec<String> = event
                    .paths
                    .into_iter()
                    .filter(|path| !should_ignore_path(path, &project_root))
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();

                // Only emit if we have non-ignored paths
                if !paths.is_empty() {
                    let _ = app_handle.emit("project://file-event", paths);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn update_ignore_patterns(_patterns: Vec<String>) -> Result<(), String> {
    // For now, we'll just clear the current patterns
    // They'll be rebuilt when set_project_root is called again
    let ignore_cell = IGNORE_PATTERNS.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = ignore_cell.lock() {
        *guard = None;
    }
    Ok(())
}

#[tauri::command]
pub fn stop_project_watch() -> Result<(), String> {
    if let Some(cell) = WATCHER.get() {
        if let Ok(mut guard) = cell.lock() {
            if let Some(_w) = guard.take() {
                // dropping stops the watcher
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn search_project_files(
    query: String,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<SearchResult, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    // Get the current project root from the file watcher
    // For now, we'll use the current working directory if no project is set
    let project_root =
        std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?;

    let case_sensitive = case_sensitive.unwrap_or(false);
    let max_results = max_results.unwrap_or(100);

    walk_directory(&project_root, &query, case_sensitive, max_results)
}

#[tauri::command]
pub fn search_project_files_in_path(
    path: String,
    query: String,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<SearchResult, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    let search_path = PathBuf::from(path);
    if !search_path.exists() || !search_path.is_dir() {
        return Err("Search path does not exist or is not a directory".to_string());
    }

    let case_sensitive = case_sensitive.unwrap_or(false);
    let max_results = max_results.unwrap_or(100);

    walk_directory(&search_path, &query, case_sensitive, max_results)
}

// Project type detection
use crate::project::ProjectInfo;

#[tauri::command]
pub async fn detect_project_type(path: Option<String>) -> Result<ProjectInfo, String> {
    let project_path = match path {
        Some(p) => PathBuf::from(p),
        None => std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?,
    };

    Ok(ProjectInfo::detect(&project_path))
}
