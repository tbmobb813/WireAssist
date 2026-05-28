use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::env;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

// Performance optimizations
const IPC_TIMEOUT: Duration = Duration::from_secs(10);
const BUFFER_SIZE: usize = 4096;

#[derive(Parser)]
#[command(name = "lai")]
#[command(about = "Linux AI Assistant CLI - Terminal companion for the Linux AI Desktop Assistant")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(long_about = "
Linux AI Assistant CLI provides command-line access to the desktop AI assistant.

Examples:
  lai ask \"How do I optimize this SQL query?\"
  lai notify \"Build completed successfully\"
  lai last
  lai capture \"npm test\" --analyze
  lai capture \"make build\" --timeout 60 --ai-analyze
  DEV_MODE=1 lai create \"Test assistant message\"

For more information, see: https://github.com/tbmobb813/Linux-AI-Assistant---Project
")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Send a question to the AI assistant (alias: chat)
    Ask {
        /// The question or prompt to send to the AI
        message: Option<String>,
        /// Override the default model (e.g., gpt-4, claude-sonnet)
        #[arg(long)]
        model: Option<String>,
        /// Override the default provider (e.g., openai, anthropic, ollama)
        #[arg(long)]
        provider: Option<String>,
        /// Start a new conversation instead of continuing the current one
        #[arg(long, default_value_t = false)]
        new: bool,
        /// Open the response in GUI instead of terminal
        #[arg(long, default_value_t = false)]
        gui: bool,
        /// Read from stdin if no message provided
        #[arg(long, default_value_t = false)]
        stdin: bool,
    },
    /// Alias for 'ask' - send a question to the AI assistant
    Chat {
        /// The question or prompt to send to the AI
        message: Option<String>,
        /// Override the default model
        #[arg(long)]
        model: Option<String>,
        /// Override the default provider
        #[arg(long)]
        provider: Option<String>,
        /// Start a new conversation
        #[arg(long, default_value_t = false)]
        new: bool,
        /// Open the response in GUI
        #[arg(long, default_value_t = false)]
        gui: bool,
        /// Read from stdin
        #[arg(long, default_value_t = false)]
        stdin: bool,
    },
    /// Analyze text from stdin (e.g., cat error.log | lai analyze)
    Analyze {
        /// Optional prefix prompt before the stdin content
        prompt: Option<String>,
        /// Override the default model
        #[arg(long)]
        model: Option<String>,
        /// Override the default provider
        #[arg(long)]
        provider: Option<String>,
        /// Open the response in GUI
        #[arg(long, default_value_t = false)]
        gui: bool,
    },
    /// Send a desktop notification through the assistant app
    Notify {
        /// Message to display in the notification
        message: String,
    },
    /// Retrieve the most recent assistant response
    Last,
    /// Create a test assistant message (development/testing only)
    #[command(hide = !cfg!(debug_assertions))]
    Create {
        /// Message content to insert as assistant response
        message: String,
        /// Specific conversation ID to insert into (creates new if omitted)
        #[arg(long)]
        conversation_id: Option<String>,
    },
    /// Capture and analyze terminal command output
    Capture {
        /// Command to execute and capture
        command: String,
        /// Working directory for command execution
        #[arg(long)]
        cwd: Option<String>,
        /// Timeout in seconds (default: 30)
        #[arg(long, default_value_t = 30)]
        timeout: u64,
        /// Analyze output for errors and suggestions
        #[arg(long, default_value_t = false)]
        analyze: bool,
        /// Send results to AI for analysis
        #[arg(long, default_value_t = false)]
        ai_analyze: bool,
    },
}

#[derive(Deserialize)]
struct IpcResponse {
    status: String,
    data: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct Message {
    id: String,
    conversation_id: String,
    role: String,
    content: String,
    timestamp: i64,
    tokens_used: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug)]
struct CaptureResult {
    command: String,
    working_dir: String,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    execution_time_ms: u64,
    timed_out: bool,
    error_summary: Option<String>,
}

fn main() {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Ask {
            message,
            model,
            provider,
            new,
            gui,
            stdin,
        }
        | Commands::Chat {
            message,
            model,
            provider,
            new,
            gui,
            stdin,
        } => {
            // Get message from argument or stdin
            let msg = if *stdin || message.is_none() {
                read_stdin().unwrap_or_else(|e| {
                    eprintln!("Failed to read from stdin: {}", e);
                    std::process::exit(1);
                })
            } else {
                message.clone().unwrap_or_default()
            };

            if msg.is_empty() {
                eprintln!("No message provided. Use --stdin to read from stdin, or provide a message argument.");
                std::process::exit(1);
            }

            handle_ask(&msg, model.as_deref(), provider.as_deref(), *new, *gui);
        }
        Commands::Analyze {
            prompt,
            model,
            provider,
            gui,
        } => {
            let stdin_content = read_stdin().unwrap_or_else(|e| {
                eprintln!("Failed to read from stdin: {}", e);
                std::process::exit(1);
            });

            if stdin_content.is_empty() {
                eprintln!("No input from stdin. Usage: cat file.txt | lai analyze");
                std::process::exit(1);
            }

            let full_message = if let Some(p) = prompt {
                format!("{}\n\n{}", p, stdin_content)
            } else {
                format!("Analyze the following:\n\n{}", stdin_content)
            };

            handle_ask(
                &full_message,
                model.as_deref(),
                provider.as_deref(),
                false,
                *gui,
            );
        }
        Commands::Notify { message } => {
            if let Err(e) = send_ipc("notify", Some(message.as_str()), None) {
                eprintln!("Failed to send notify: {}", e);
                std::process::exit(1);
            }
        }
        Commands::Last => match send_ipc_with_response("last", None, None) {
            Ok(response) => {
                if response.status == "ok" {
                    if let Some(data) = response.data {
                        match serde_json::from_value::<Message>(data) {
                            Ok(message) => {
                                println!("{}", message.content);
                            }
                            Err(e) => {
                                eprintln!("Failed to parse message: {}", e);
                                std::process::exit(1);
                            }
                        }
                    } else {
                        eprintln!("No data returned");
                        std::process::exit(1);
                    }
                } else {
                    if let Some(data) = response.data {
                        if let Some(error) = data.get("error") {
                            eprintln!("Error: {}", error);
                        } else {
                            eprintln!("Error: {}", data);
                        }
                    } else {
                        eprintln!("Unknown error");
                    }
                    std::process::exit(1);
                }
            }
            Err(e) => {
                eprintln!("Failed to get last response: {}", e);
                std::process::exit(1);
            }
        },
        Commands::Create {
            message,
            conversation_id,
        } => {
            let mut payload = serde_json::Map::new();
            payload.insert(
                "content".to_string(),
                serde_json::Value::String(message.clone()),
            );
            if let Some(cid) = conversation_id {
                payload.insert(
                    "conversation_id".to_string(),
                    serde_json::Value::String(cid.clone()),
                );
            }
            if let Err(e) = send_ipc("create", None, Some(serde_json::Value::Object(payload))) {
                eprintln!("Failed to send create: {}", e);
                std::process::exit(1);
            } else {
                // Ask for the created message back and print it
                match send_ipc_with_response("last", None, None) {
                    Ok(resp) => {
                        if resp.status == "ok" {
                            if let Some(data) = resp.data {
                                match serde_json::from_value::<Message>(data) {
                                    Ok(msg) => println!("{}", msg.content),
                                    Err(e) => eprintln!("Failed to parse message: {}", e),
                                }
                            } else {
                                eprintln!("No message data returned after creation.");
                            }
                        } else {
                            eprintln!("Failed to fetch last message: status '{}'", resp.status);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to fetch last message: {}", e);
                    }
                }
            }
        }
        Commands::Capture {
            command,
            cwd,
            timeout,
            analyze,
            ai_analyze,
        } => match execute_command(command, cwd.as_deref(), *timeout) {
            Ok(result) => {
                if *analyze || *ai_analyze {
                    display_capture_analysis(&result, *ai_analyze);
                } else {
                    display_capture_result(&result);
                }
            }
            Err(e) => {
                eprintln!("Failed to execute command: {}", e);
                std::process::exit(1);
            }
        },
    }
}

#[derive(Serialize)]
struct IpcMessage<'a> {
    #[serde(rename = "type")]
    kind: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<serde_json::Value>,
}

fn send_ipc(
    kind: &str,
    message: Option<&str>,
    payload: Option<serde_json::Value>,
) -> Result<(), String> {
    let addr = "127.0.0.1:39871";

    // Optimized connection with timeouts and buffering
    let socket_addr = addr.parse().map_err(|e| format!("Failed to parse address '{}': {}", addr, e))?;
    let mut stream = TcpStream::connect_timeout(&socket_addr, IPC_TIMEOUT)
        .map_err(|e| format!("connect {} failed: {}", addr, e))?;

    // Set timeouts for read/write operations
    stream
        .set_read_timeout(Some(IPC_TIMEOUT))
        .map_err(|e| format!("set read timeout failed: {}", e))?;
    stream
        .set_write_timeout(Some(IPC_TIMEOUT))
        .map_err(|e| format!("set write timeout failed: {}", e))?;

    // Disable Nagle's algorithm for lower latency
    stream
        .set_nodelay(true)
        .map_err(|e| format!("set nodelay failed: {}", e))?;

    let body = IpcMessage {
        kind,
        message,
        payload,
    };

    // Serialize once and reuse
    let json = serde_json::to_string(&body).map_err(|e| e.to_string())?;
    let message_bytes = format!("{}\n", json);

    stream
        .write_all(message_bytes.as_bytes())
        .map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;

    // Read acknowledgment with buffered reader
    let mut reader = BufReader::with_capacity(BUFFER_SIZE, stream);
    let mut line = String::with_capacity(256);
    reader.read_line(&mut line).map_err(|e| e.to_string())?;
    Ok(())
}

fn send_ipc_with_response(
    kind: &str,
    message: Option<&str>,
    payload: Option<serde_json::Value>,
) -> Result<IpcResponse, String> {
    let addr = "127.0.0.1:39871";

    // Optimized connection setup
    let mut stream = TcpStream::connect_timeout(&addr.parse().unwrap(), IPC_TIMEOUT)
        .map_err(|e| format!("connect {} failed: {}", addr, e))?;

    // Configure timeouts
    stream
        .set_read_timeout(Some(IPC_TIMEOUT))
        .map_err(|e| format!("set read timeout failed: {}", e))?;
    stream
        .set_write_timeout(Some(IPC_TIMEOUT))
        .map_err(|e| format!("set write timeout failed: {}", e))?;
    stream
        .set_nodelay(true)
        .map_err(|e| format!("set nodelay failed: {}", e))?;

    let body = IpcMessage {
        kind,
        message,
        payload,
    };

    let json = serde_json::to_string(&body).map_err(|e| e.to_string())?;
    let message_bytes = format!("{}\n", json);

    stream
        .write_all(message_bytes.as_bytes())
        .map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;

    // Read response with optimized buffering
    let mut reader = BufReader::with_capacity(BUFFER_SIZE, stream);
    let mut line = String::with_capacity(512);
    reader.read_line(&mut line).map_err(|e| e.to_string())?;

    serde_json::from_str(&line).map_err(|e| format!("Failed to parse response: {}", e))
}

fn execute_command(
    command: &str,
    working_dir: Option<&str>,
    timeout_secs: u64,
) -> Result<CaptureResult, String> {
    let start_time = Instant::now();
    let working_dir = working_dir.map(|s| s.to_string()).unwrap_or_else(|| {
        env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    });

    // Parse command into parts (simple shell-like parsing)
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty command".to_string());
    }

    let mut cmd = Command::new(parts[0]);
    if parts.len() > 1 {
        cmd.args(&parts[1..]);
    }

    cmd.current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    // Handle timeout
    let timeout_duration = Duration::from_secs(timeout_secs);
    let mut timed_out = false;
    let mut exit_code = None;

    // Check if process completed within timeout
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                exit_code = status.code();
                break;
            }
            Ok(None) => {
                if start.elapsed() >= timeout_duration {
                    let _ = child.kill(); // Kill the process
                    let _ = child.wait(); // Clean up
                    timed_out = true;
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                return Err(format!("Error waiting for process: {}", e));
            }
        }
    }

    // Get output
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to read output: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let execution_time = start_time.elapsed().as_millis() as u64;

    // Simple error detection
    let error_summary = if exit_code.unwrap_or(-1) != 0 || !stderr.is_empty() {
        Some(analyze_error_output(&stderr, &stdout, exit_code))
    } else {
        None
    };

    Ok(CaptureResult {
        command: command.to_string(),
        working_dir,
        exit_code,
        stdout,
        stderr,
        execution_time_ms: execution_time,
        timed_out,
        error_summary,
    })
}

fn analyze_error_output(stderr: &str, _stdout: &str, exit_code: Option<i32>) -> String {
    let mut analysis = Vec::new();

    if let Some(code) = exit_code {
        if code != 0 {
            analysis.push(format!("Process exited with code {}", code));
        }
    }

    if !stderr.is_empty() {
        analysis.push("Error output detected".to_string());

        // Common error patterns
        let stderr_lower = stderr.to_lowercase();
        if stderr_lower.contains("permission denied") {
            analysis.push("Permission issue - try with sudo or check file permissions".to_string());
        }
        if stderr_lower.contains("command not found") || stderr_lower.contains("no such file") {
            analysis.push("Command or file not found - check spelling and PATH".to_string());
        }
        if stderr_lower.contains("connection") && stderr_lower.contains("refused") {
            analysis.push("Connection refused - check if service is running".to_string());
        }
        if stderr_lower.contains("out of memory") || stderr_lower.contains("oom") {
            analysis.push(
                "Memory issue - consider freeing up memory or using less memory-intensive options"
                    .to_string(),
            );
        }
    }

    if analysis.is_empty() {
        "Command completed but may have issues".to_string()
    } else {
        analysis.join("; ")
    }
}

fn read_stdin() -> Result<String, String> {
    let stdin = io::stdin();
    let mut content = String::new();

    stdin
        .lock()
        .read_to_string(&mut content)
        .map_err(|e| format!("Failed to read stdin: {}", e))?;

    Ok(content.trim().to_string())
}

fn handle_ask(message: &str, model: Option<&str>, provider: Option<&str>, new: bool, gui: bool) {
    let payload = serde_json::json!({
        "prompt": message,
        "model": model,
        "provider": provider,
        "new": new,
        "gui": gui,
    });

    if let Err(e) = send_ipc("ask", None, Some(payload)) {
        eprintln!("Failed to send ask: {}", e);
        std::process::exit(1);
    }

    if !gui {
        // Wait briefly for processing
        std::thread::sleep(Duration::from_millis(500));

        // Show a loading indicator
        eprint!("Processing");
        for _ in 0..3 {
            std::thread::sleep(Duration::from_millis(300));
            eprint!(".");
        }
        eprintln!();

        // Get the response
        match send_ipc_with_response("last", None, None) {
            Ok(response) => {
                if response.status == "ok" {
                    if let Some(data) = response.data {
                        match serde_json::from_value::<Message>(data) {
                            Ok(msg) => {
                                println!("\n{}", msg.content);
                            }
                            Err(e) => {
                                eprintln!("Failed to parse response: {}", e);
                                std::process::exit(1);
                            }
                        }
                    } else {
                        eprintln!("No response data");
                        std::process::exit(1);
                    }
                } else {
                    eprintln!("Request failed: {}", response.status);
                    std::process::exit(1);
                }
            }
            Err(e) => {
                eprintln!("Failed to get response: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        println!("Request sent. Check the GUI for the response.");
    }
}

fn display_capture_result(result: &CaptureResult) {
    println!("Command: {}", result.command);
    println!("Working Directory: {}", result.working_dir);
    println!("Execution Time: {}ms", result.execution_time_ms);

    if result.timed_out {
        println!("Status: TIMED OUT");
    } else if let Some(code) = result.exit_code {
        println!("Exit Code: {}", code);
    }

    if !result.stdout.is_empty() {
        println!("\n--- STDOUT ---");
        println!("{}", result.stdout);
    }

    if !result.stderr.is_empty() {
        println!("\n--- STDERR ---");
        println!("{}", result.stderr);
    }

    if let Some(summary) = &result.error_summary {
        println!("\n--- ANALYSIS ---");
        println!("{}", summary);
    }
}

fn display_capture_analysis(result: &CaptureResult, use_ai: bool) {
    display_capture_result(result);

    if use_ai {
        println!("\n--- AI ANALYSIS ---");

        // Create a formatted analysis request
        let analysis_prompt = format!(
            "Analyze this terminal command execution:\n\nCommand: {}\nExit Code: {:?}\nExecution Time: {}ms\n\nSTDOUT:\n{}\n\nSTDERR:\n{}\n\nProvide:\n1. What the command was trying to do\n2. Whether it succeeded or failed\n3. If failed, what went wrong\n4. Suggestions for fixes or improvements\n5. Any security or performance considerations",
            result.command,
            result.exit_code,
            result.execution_time_ms,
            result.stdout,
            result.stderr
        );

        // Send to AI via existing ask mechanism
        let payload = serde_json::json!({
            "prompt": analysis_prompt,
            "new": false,
        });

        match send_ipc_with_response("ask", None, Some(payload)) {
            Ok(response) => {
                if response.status == "ok" {
                    // Get the AI response
                    std::thread::sleep(Duration::from_millis(1000)); // Wait for processing
                    match send_ipc_with_response("last", None, None) {
                        Ok(last_response) => {
                            if let Some(data) = last_response.data {
                                if let Ok(message) = serde_json::from_value::<Message>(data) {
                                    println!("{}", message.content);
                                } else {
                                    println!("Failed to parse AI response");
                                }
                            }
                        }
                        Err(e) => println!("Failed to get AI analysis: {}", e),
                    }
                } else {
                    println!("AI analysis failed: {}", response.status);
                }
            }
            Err(e) => println!("Failed to request AI analysis: {}", e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipc_message_serialization() {
        let msg = IpcMessage {
            kind: "test",
            message: Some("hello"),
            payload: Some(serde_json::json!({"key": "value"})),
        };

        let json = serde_json::to_string(&msg).expect("Serialization should work");
        assert!(json.contains("\"type\":\"test\""));
        assert!(json.contains("\"message\":\"hello\""));
        assert!(json.contains("\"key\":\"value\""));
    }

    #[test]
    fn test_ipc_response_deserialization() {
        let json = r#"{"status":"ok","data":{"content":"test message"}}"#;
        let response: IpcResponse =
            serde_json::from_str(json).expect("Deserialization should work");

        assert_eq!(response.status, "ok");
        assert!(response.data.is_some());
    }

    #[test]
    fn test_message_deserialization() {
        let json = r#"{
            "id": "test-id",
            "conversation_id": "conv-id",
            "role": "assistant",
            "content": "test content",
            "timestamp": 1234567890,
            "tokens_used": 100
        }"#;

        let message: Message =
            serde_json::from_str(json).expect("Message deserialization should work");
        assert_eq!(message.id, "test-id");
        assert_eq!(message.content, "test content");
        assert_eq!(message.role, "assistant");
        assert_eq!(message.tokens_used, Some(100));
    }

    #[test]
    fn test_error_response_handling() {
        let json = r#"{"status":"error","data":{"error":"Test error message"}}"#;
        let response: IpcResponse =
            serde_json::from_str(json).expect("Error response should deserialize");

        assert_eq!(response.status, "error");
        if let Some(data) = response.data {
            assert_eq!(
                data.get("error").and_then(|v| v.as_str()),
                Some("Test error message")
            );
        } else {
            panic!("Error response should have data");
        }
    }

    #[test]
    fn test_capture_result_serialization() {
        let result = CaptureResult {
            command: "echo test".to_string(),
            working_dir: "/tmp".to_string(),
            exit_code: Some(0),
            stdout: "test\n".to_string(),
            stderr: "".to_string(),
            execution_time_ms: 100,
            timed_out: false,
            error_summary: None,
        };

        let json = serde_json::to_string(&result).expect("Serialization should work");
        assert!(json.contains("echo test"));
        assert!(json.contains("\"exit_code\":0"));
        assert!(json.contains("\"timed_out\":false"));
    }

    #[test]
    fn test_analyze_error_output() {
        let stderr = "bash: nonexistent-command: command not found";
        let stdout = "";
        let exit_code = Some(127);

        let analysis = analyze_error_output(stderr, stdout, exit_code);
        assert!(analysis.contains("Process exited with code 127"));
        assert!(analysis.contains("Command or file not found"));
    }

    #[test]
    fn test_execute_simple_command() {
        // Test a simple command that should work on most systems
        let result = execute_command("echo hello", None, 5);
        assert!(result.is_ok());

        let capture = result.unwrap();
        assert_eq!(capture.command, "echo hello");
        assert_eq!(capture.exit_code, Some(0));
        assert!(capture.stdout.contains("hello"));
        assert!(!capture.timed_out);
    }

    // Integration test that requires a running backend
    #[test]
    #[ignore] // Ignored by default since it requires backend to be running
    fn test_connection_timeout() {
        // This test verifies that connection timeouts work properly
        // when connecting to a non-existent server
        let result = send_ipc("test", None, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("connect"));
    }
}
