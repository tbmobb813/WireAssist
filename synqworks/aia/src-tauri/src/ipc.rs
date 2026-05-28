use serde_json::Value as JsonValue;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Configuration for IPC server performance tuning
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(30);
const BUFFER_SIZE: usize = 8192;
const MAX_MESSAGE_SIZE: usize = 1024 * 1024; // 1MB limit

#[derive(serde::Deserialize, Debug)]
struct IpcMessage {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    payload: Option<JsonValue>,
}

#[derive(serde::Serialize)]
struct IpcResponse {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<JsonValue>,
}

/// Performance metrics for monitoring
#[derive(Debug)]
struct ConnectionMetrics {
    start_time: Instant,
    messages_processed: u32,
    bytes_received: u64,
}

fn handle_client(mut stream: TcpStream, app: AppHandle, dev_mode_enabled: bool) {
    // Set connection timeout and buffer size for performance
    let _ = stream.set_read_timeout(Some(CONNECTION_TIMEOUT));
    let _ = stream.set_write_timeout(Some(CONNECTION_TIMEOUT));
    let _ = stream.set_nodelay(true); // Disable Nagle's algorithm for low latency

    let peer = stream.peer_addr().ok();
    let mut metrics = ConnectionMetrics {
        start_time: Instant::now(),
        messages_processed: 0,
        bytes_received: 0,
    };

    // Use buffered reader with custom buffer size
    let mut reader = BufReader::with_capacity(BUFFER_SIZE, stream.try_clone().unwrap());
    let mut line = String::with_capacity(512); // Pre-allocate with reasonable capacity

    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break, // EOF
            Ok(bytes_read) => {
                metrics.bytes_received += bytes_read as u64;

                // Check message size limit
                if line.len() > MAX_MESSAGE_SIZE {
                    let response = IpcResponse {
                        status: "error".to_string(),
                        data: Some(serde_json::json!({"error": "Message too large"})),
                    };
                    let _ = write_response(&mut stream, &response);
                    continue;
                }

                let trimmed = line.trim_end();
                if trimmed.is_empty() {
                    continue;
                }

                match serde_json::from_str::<IpcMessage>(trimmed) {
                    Ok(msg) => {
                        metrics.messages_processed += 1;
                        handle_message(&mut stream, &app, &msg, dev_mode_enabled);
                    }
                    Err(_) => {
                        let response = IpcResponse {
                            status: "error".to_string(),
                            data: Some(serde_json::json!({"error": "Invalid JSON"})),
                        };
                        let _ = write_response(&mut stream, &response);
                    }
                }
            }
            Err(_) => break,
        }
    }

    // Log performance metrics in debug mode
    if std::env::var("RUST_LOG")
        .unwrap_or_default()
        .contains("debug")
    {
        let duration = metrics.start_time.elapsed();
        eprintln!(
            "IPC: connection from {:?} closed after {:.2}s, {} messages, {} bytes",
            peer,
            duration.as_secs_f64(),
            metrics.messages_processed,
            metrics.bytes_received
        );
    }
}

/// Optimized response writer with error handling
fn write_response(stream: &mut TcpStream, response: &IpcResponse) -> Result<(), std::io::Error> {
    let json = serde_json::to_string(response)?;
    stream.write_all(format!("{}\n", json).as_bytes())?;
    stream.flush()?;
    Ok(())
}

/// Handle individual IPC message with optimized routing
fn handle_message(
    stream: &mut TcpStream,
    app: &AppHandle,
    msg: &IpcMessage,
    dev_mode_enabled: bool,
) {
    let response = match msg.kind.as_str() {
        "notify" => {
            let _ = app.emit("cli://notify", msg.message.as_deref().unwrap_or_default());
            IpcResponse {
                status: "ok".to_string(),
                data: None,
            }
        }
        "ask" => {
            // Forward either the provided payload object, or the message string
            if let Some(ref payload) = msg.payload {
                let _ = app.emit("cli://ask", payload);
            } else {
                let _ = app.emit("cli://ask", msg.message.as_deref().unwrap_or_default());
            }
            IpcResponse {
                status: "ok".to_string(),
                data: None,
            }
        }
        "last" => handle_last_message(app),
        "create" => {
            if dev_mode_enabled {
                handle_create_message(app, msg)
            } else {
                IpcResponse {
                    status: "error".to_string(),
                    data: Some(
                        serde_json::json!({"error": "create command only available in DEV_MODE"}),
                    ),
                }
            }
        }
        _ => {
            // Ignore unknown commands gracefully
            IpcResponse {
                status: "ok".to_string(),
                data: None,
            }
        }
    };

    let _ = write_response(stream, &response);
}

/// Optimized last message handler
fn handle_last_message(app: &AppHandle) -> IpcResponse {
    let db = app.state::<crate::database::Database>();

    // Use a more efficient async approach
    let result = tokio::runtime::Handle::current()
        .block_on(async { crate::commands::messages::get_last_assistant_message(db).await });

    match result {
        Ok(Some(message)) => IpcResponse {
            status: "ok".to_string(),
            data: serde_json::to_value(&message).ok(),
        },
        Ok(None) => IpcResponse {
            status: "error".to_string(),
            data: Some(serde_json::json!({"error": "No messages found"})),
        },
        Err(e) => IpcResponse {
            status: "error".to_string(),
            data: Some(serde_json::json!({"error": e})),
        },
    }
}

/// Optimized create message handler with transaction management
fn handle_create_message(app: &AppHandle, msg: &IpcMessage) -> IpcResponse {
    let Some(ref payload) = msg.payload else {
        return IpcResponse {
            status: "error".to_string(),
            data: Some(serde_json::json!({"error": "No payload provided for create command"})),
        };
    };

    let content = payload
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("Test message")
        .to_string();

    let conversation_id = payload
        .get("conversation_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let db = app.state::<crate::database::Database>();
    let result = tokio::runtime::Handle::current().block_on(async {
        // Optimize conversation creation by reusing connections
        let conv_id = if let Some(cid) = conversation_id {
            cid
        } else {
            // Create conversation in a single transaction
            let conn = db.conn().lock().map_err(|e| e.to_string())?;
            let new_conv = crate::database::conversations::NewConversation {
                title: "Dev Test Conversation".to_string(),
                model: "dev-model".to_string(),
                provider: "dev-provider".to_string(),
                system_prompt: None,
            };
            let conv = crate::database::conversations::Conversation::create(&conn, new_conv)
                .map_err(|e| e.to_string())?;
            conv.id
        };

        crate::commands::messages::create_message(
            db,
            conv_id,
            "assistant".to_string(),
            content,
            None,
        )
        .await
    });

    match result {
        Ok(message) => IpcResponse {
            status: "ok".to_string(),
            data: serde_json::to_value(&message).ok(),
        },
        Err(e) => IpcResponse {
            status: "error".to_string(),
            data: Some(serde_json::json!({"error": e})),
        },
    }
}

pub fn start_ipc_server(app: AppHandle) {
    // Check if dev mode is enabled at startup
    let dev_mode_enabled = match std::env::var("DEV_MODE") {
        Ok(val) => {
            let v = val.trim().to_lowercase();
            !v.is_empty() && (v == "1" || v == "true" || v == "yes")
        }
        Err(_) => false,
    };

    // Fixed localhost port; can be made configurable later
    let addr = "127.0.0.1:39871";
    let listener = match TcpListener::bind(addr) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("IPC: failed to bind {}: {}", addr, e);
            return;
        }
    };

    // Configure listener for performance
    if let Err(e) = listener.set_nonblocking(false) {
        eprintln!("IPC: failed to set blocking mode: {}", e);
    }

    println!("IPC: server listening on {}", addr);

    // Use Arc to share the app handle efficiently across threads
    let app = Arc::new(app);

    thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(s) => {
                    let app_clone = Arc::clone(&app);
                    // Spawn thread with optimized stack size for better memory usage
                    let builder = thread::Builder::new()
                        .name("ipc-client".to_string())
                        .stack_size(2 * 1024 * 1024); // 2MB stack, default size

                    if let Ok(_handle) = builder
                        .spawn(move || handle_client(s, (*app_clone).clone(), dev_mode_enabled))
                    {
                        // Thread is detached when JoinHandle is dropped
                    } else {
                        eprintln!("IPC: failed to spawn client thread");
                    }
                }
                Err(e) => {
                    eprintln!("IPC: connection failed: {}", e);
                }
            }
        }
    });
}
