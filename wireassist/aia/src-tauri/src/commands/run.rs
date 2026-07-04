use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Serialize, Debug)]
pub struct RunResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
}

/// Execute user-provided code snippet safely in a temporary file and return output.
/// Only a small whitelist of languages is supported.
#[tauri::command]
pub async fn run_code(
    language: String,
    code: String,
    timeout_ms: Option<u64>,
    cwd: Option<String>,
) -> Result<RunResult, String> {
    // Whitelist languages we support
    let lang = language.to_lowercase();
    let supported = ["bash", "sh", "zsh", "python", "node", "javascript"];
    if !supported.contains(&lang.as_str()) {
        return Err(format!("Unsupported language: {}", language));
    }

    let timeout = Duration::from_millis(timeout_ms.unwrap_or(10_000));

    // Create temporary file
    let mut suffix = ".txt".to_string();
    if lang == "python" {
        suffix = ".py".to_string();
    } else if lang == "node" || lang == "javascript" {
        suffix = ".js".to_string();
    } else if lang == "bash" || lang == "sh" || lang == "zsh" {
        suffix = ".sh".to_string();
    }

    let mut tmp = tempfile::Builder::new()
        .suffix(&suffix)
        .tempfile()
        .map_err(|e| format!("failed to create temp file: {}", e))?;

    tmp.write_all(code.as_bytes())
        .map_err(|e| format!("failed to write temp file: {}", e))?;

    let path = tmp.path().to_owned();

    // Build command
    let mut cmd = if lang == "python" {
        let mut c = Command::new("python3");
        c.arg(path.clone());
        c
    } else if lang == "node" || lang == "javascript" {
        let mut c = Command::new("node");
        c.arg(path.clone());
        c
    } else {
        // shell
        let mut c = Command::new("sh");
        c.arg(path.clone());
        c
    };

    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("failed to spawn: {}", e))?;

    let start = Instant::now();
    // Poll for completion with timeout
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = String::new();
                if let Some(mut out) = child.stdout.take() {
                    use std::io::Read;
                    let _ = out.read_to_string(&mut stdout);
                }
                let mut stderr = String::new();
                if let Some(mut err) = child.stderr.take() {
                    use std::io::Read;
                    let _ = err.read_to_string(&mut stderr);
                }
                let code = status.code();
                // Audit log
                let _ = append_audit(&language, cwd.as_deref(), code, false, &stdout, &stderr);
                return Ok(RunResult {
                    stdout,
                    stderr,
                    exit_code: code,
                    timed_out: false,
                });
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    // kill
                    let _ = child.kill();
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
                continue;
            }
            Err(e) => return Err(format!("failed to poll child: {}", e)),
        }
    }

    // If we reach here, we timed out. Collect whatever output is available.
    let mut stdout = String::new();
    if let Some(mut out) = child.stdout.take() {
        use std::io::Read;
        let _ = out.read_to_string(&mut stdout);
    }
    let mut stderr = String::new();
    if let Some(mut err) = child.stderr.take() {
        use std::io::Read;
        let _ = err.read_to_string(&mut stderr);
    }

    // Audit log for timeout
    let _ = append_audit(&language, cwd.as_deref(), None, true, &stdout, &stderr);
    Ok(RunResult {
        stdout,
        stderr,
        exit_code: None,
        timed_out: true,
    })
}

/// Read the audit log and return the last `lines` lines joined as a string.
#[tauri::command]
pub fn read_audit(lines: Option<usize>) -> Result<String, String> {
    let log_path = get_audit_log_path();

    let content = match std::fs::read_to_string(&log_path) {
        Ok(s) => s,
        Err(e) => return Err(format!("failed to read audit log: {}", e)),
    };

    let l = lines.unwrap_or(200);
    let v: Vec<&str> = content.lines().collect();
    let start = if v.len() > l { v.len() - l } else { 0 };
    let slice = &v[start..];
    Ok(slice.join("\n"))
}

/// Rotate the audit log immediately (move executions.log -> executions.log.1).
#[tauri::command]
pub fn rotate_audit() -> Result<(), String> {
    let log_path = get_audit_log_path();
    let mut rot = log_path.clone();
    rot.set_extension("log.1");

    // Remove old rotation
    let _ = std::fs::remove_file(&rot);
    fs::rename(&log_path, &rot).map_err(|e| format!("failed to rotate audit log: {}", e))?;
    Ok(())
}

fn get_audit_log_path() -> PathBuf {
    // In a real Tauri app context, this would use app.path().app_data_dir()
    // For now, use current directory as fallback (works in tests and when no app handle)
    let mut log_path = PathBuf::from(".");
    log_path.push("executions.log");
    log_path
}

fn append_audit(
    language: &str,
    cwd: Option<&str>,
    exit_code: Option<i32>,
    timed_out: bool,
    stdout: &str,
    stderr: &str,
) -> Result<(), String> {
    let log_path = get_audit_log_path();

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut entry = format!(
        "{} | lang={} | exit={:?} | timed_out={} | cwd={:?}\n",
        ts, language, exit_code, timed_out, cwd
    );
    // Truncate outputs to avoid massive logs
    let take = |s: &str, n: usize| {
        if s.len() > n {
            format!("{}...", &s[..n])
        } else {
            s.to_string()
        }
    };
    entry.push_str(&format!("STDOUT: {}\n", take(stdout, 1000)));
    entry.push_str(&format!("STDERR: {}\n", take(stderr, 1000)));
    entry.push_str("---\n");

    // Append to file
    // Rotate if too large (1 MB)
    const MAX_LOG_BYTES: u64 = 1_048_576;
    if let Ok(meta) = fs::metadata(&log_path) {
        if meta.len() > MAX_LOG_BYTES {
            let mut rot = log_path.clone();
            rot.set_extension("log.1");
            // Remove previous rotation if exists
            let _ = fs::remove_file(&rot);
            if let Err(e) = fs::rename(&log_path, &rot) {
                eprintln!("failed to rotate audit log: {}", e);
            }
        }
    }

    match OpenOptions::new().create(true).append(true).open(&log_path) {
        Ok(mut f) => {
            if let Err(e) = f.write_all(entry.as_bytes()) {
                eprintln!("failed to write audit log: {}", e);
            }
        }
        Err(e) => {
            eprintln!("failed to open audit log {:?}: {}", log_path, e);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Basic test: run a simple echo in sh and ensure output is captured.
    #[tokio::test]
    async fn test_run_code_echo_sh() {
        let r = run_code("sh".into(), "echo test-run".into(), Some(2000), None)
            .await
            .expect("run_code failed");
        assert!(r.stdout.contains("test-run"));
        assert!(!r.timed_out);
    }

    // Test python execution
    #[tokio::test]
    async fn test_run_code_python() {
        let code = "print('hello from python')";
        let r = run_code("python".into(), code.into(), Some(2000), None)
            .await
            .expect("run_code failed");
        assert!(r.stdout.contains("hello from python"));
        assert_eq!(r.exit_code, Some(0));
        assert!(!r.timed_out);
    }

    // Test node/javascript execution
    #[tokio::test]
    async fn test_run_code_node() {
        let code = "console.log('hello from node');";
        let r = run_code("node".into(), code.into(), Some(2000), None)
            .await
            .expect("run_code failed");
        assert!(r.stdout.contains("hello from node"));
        assert_eq!(r.exit_code, Some(0));
        assert!(!r.timed_out);
    }

    // Test timeout behavior
    #[tokio::test]
    async fn test_run_code_timeout() {
        let code = "sleep 10"; // sleep longer than timeout
        let r = run_code("sh".into(), code.into(), Some(500), None)
            .await
            .expect("run_code failed");
        assert!(r.timed_out, "Expected timeout but got timed_out=false");
        assert_eq!(r.exit_code, None);
    }

    // Test unsupported language rejection
    #[tokio::test]
    async fn test_run_code_unsupported_language() {
        let r = run_code("ruby".into(), "puts 'test'".into(), Some(2000), None).await;
        assert!(r.is_err());
        assert!(r.unwrap_err().contains("Unsupported language"));
    }
}
