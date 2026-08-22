use crate::database::{
    conversations::{Conversation, NewConversationWithId},
    messages::{Message, NewMessageWithId},
    Database,
};
use comrak::{markdown_to_html, ComrakOptions};
use printpdf::*;
use serde::{Deserialize, Serialize};
use std::io::BufWriter;
use tauri::{Manager, State};

#[derive(Serialize, Deserialize)]
pub struct ExportedConversation {
    pub id: String,
    pub title: String,
    pub provider: String,
    pub model: String,
    pub system_prompt: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub messages: Vec<ExportedMessage>,
}

#[derive(Serialize, Deserialize)]
pub struct ExportedMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    pub tokens_used: Option<i64>,
}

#[derive(Serialize, Deserialize)]
pub struct ExportData {
    pub version: String,
    pub export_timestamp: i64,
    pub conversations: Vec<ExportedConversation>,
}

#[tauri::command]
pub fn export_conversations_json(
    db: State<'_, Database>,
    conversation_ids: Option<Vec<String>>,
) -> Result<String, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Get conversations to export (all if none specified)
    let conversations = if let Some(ids) = conversation_ids {
        let mut result = Vec::new();
        for id in ids {
            match Conversation::get_by_id(&conn, &id) {
                Ok(Some(conv)) => result.push(conv),
                Ok(None) => continue,
                Err(e) => return Err(format!("Failed to get conversation {}: {}", id, e)),
            }
        }
        result
    } else {
        Conversation::get_all(&conn, 1000) // Get up to 1000 conversations
            .map_err(|e| format!("Failed to get conversations: {}", e))?
    };

    let mut exported_conversations = Vec::new();

    for conv in conversations {
        let messages = Message::get_by_conversation(&conn, &conv.id)
            .map_err(|e| format!("Failed to get messages for conversation {}: {}", conv.id, e))?;

        let exported_messages: Vec<ExportedMessage> = messages
            .into_iter()
            .map(|msg| ExportedMessage {
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                tokens_used: msg.tokens_used,
            })
            .collect();

        exported_conversations.push(ExportedConversation {
            id: conv.id,
            title: conv.title,
            provider: conv.provider,
            model: conv.model,
            system_prompt: conv.system_prompt,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            messages: exported_messages,
        });
    }

    let export_data = ExportData {
        version: "1.0.0".to_string(),
        export_timestamp: chrono::Utc::now().timestamp(),
        conversations: exported_conversations,
    };

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize export data: {}", e))
}

#[tauri::command]
pub fn export_conversation_markdown(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<String, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    let conversation = Conversation::get_by_id(&conn, &conversation_id)
        .map_err(|e| format!("Failed to get conversation: {}", e))?
        .ok_or_else(|| "Conversation not found".to_string())?;

    let messages = Message::get_by_conversation(&conn, &conversation_id)
        .map_err(|e| format!("Failed to get messages: {}", e))?;

    let mut markdown = String::new();

    // Header
    markdown.push_str(&format!("# {}\n\n", conversation.title));
    markdown.push_str(&format!("**Provider:** {}\n", conversation.provider));
    markdown.push_str(&format!("**Model:** {}\n", conversation.model));
    markdown.push_str(&format!(
        "**Created:** {}\n",
        chrono::DateTime::from_timestamp(conversation.created_at, 0)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S UTC").to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    ));
    markdown.push_str("\n---\n\n");

    // Messages
    for msg in messages {
        let role_header = match msg.role.as_str() {
            "user" => "## 👤 User",
            "assistant" => "## 🤖 Assistant",
            "system" => "## ⚙️ System",
            _ => &format!("## {}", msg.role),
        };

        markdown.push_str(&format!("{}\n\n", role_header));
        markdown.push_str(&format!("{}\n\n", msg.content));

        if let Some(tokens) = msg.tokens_used {
            markdown.push_str(&format!("*Tokens used: {}*\n\n", tokens));
        }

        markdown.push_str("---\n\n");
    }

    Ok(markdown)
}

#[tauri::command]
pub fn export_conversation_html(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<String, String> {
    let markdown_content = export_conversation_markdown(db, conversation_id)?;

    // Configure comrak options for better HTML output
    let mut options = ComrakOptions::default();
    options.extension.strikethrough = true;
    options.extension.tagfilter = false;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.superscript = true;
    options.extension.footnotes = true;
    options.render.hardbreaks = true;
    options.render.unsafe_ = false; // Keep safe

    let html_body = markdown_to_html(&markdown_content, &options);

    // Create a complete HTML document with CSS styling
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Conversation Export</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background-color: #fff;
        }}

        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }}

        h2 {{
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            padding: 10px 15px;
            border-left: 4px solid #3498db;
            background-color: #f8f9fa;
        }}

        p {{
            margin-bottom: 15px;
            text-align: justify;
        }}

        pre {{
            background-color: #f4f4f4;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            overflow-x: auto;
            margin: 15px 0;
        }}

        code {{
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Code", "Fira Mono", "Droid Sans Mono", "Source Code Pro", monospace;
        }}

        blockquote {{
            border-left: 4px solid #e74c3c;
            margin: 15px 0;
            padding: 10px 20px;
            background-color: #fdf2f2;
            font-style: italic;
        }}

        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
        }}

        th, td {{
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }}

        th {{
            background-color: #f2f2f2;
            font-weight: bold;
        }}

        hr {{
            border: none;
            height: 2px;
            background: linear-gradient(to right, #3498db, #transparent);
            margin: 30px 0;
        }}

        .metadata {{
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 30px;
            font-size: 14px;
        }}

        .metadata strong {{
            color: #2c3e50;
        }}

        .timestamp {{
            color: #7f8c8d;
            font-size: 12px;
            font-style: italic;
            margin-top: 10px;
        }}

        .tokens {{
            color: #8e44ad;
            font-size: 12px;
            font-style: italic;
            margin-top: 5px;
        }}

        @media print {{
            body {{
                max-width: none;
                margin: 0;
                padding: 20px;
            }}

            h2 {{
                page-break-after: avoid;
            }}

            pre, blockquote {{
                page-break-inside: avoid;
            }}
        }}

        @media (max-width: 600px) {{
            body {{
                margin: 20px;
                padding: 15px;
            }}

            h1 {{
                font-size: 24px;
            }}

            h2 {{
                font-size: 18px;
                padding: 8px 12px;
            }}
        }}
    </style>
</head>
<body>
    {}
    <div class="timestamp">
        <hr>
        <p><em>Exported on {}</em></p>
    </div>
</body>
</html>"#,
        html_body,
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );

    Ok(html)
}

#[tauri::command]
pub fn export_conversation_pdf(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<Vec<u8>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    let conversation = Conversation::get_by_id(&conn, &conversation_id)
        .map_err(|e| format!("Failed to get conversation: {}", e))?
        .ok_or_else(|| "Conversation not found".to_string())?;

    let messages = Message::get_by_conversation(&conn, &conversation_id)
        .map_err(|e| format!("Failed to get messages: {}", e))?;

    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new(
        "AI Conversation Export",
        Mm(210.0), // A4 width
        Mm(297.0), // A4 height
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Define fonts and sizes
    let helvetica = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let helvetica_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;
    let _courier = doc
        .add_builtin_font(BuiltinFont::Courier)
        .map_err(|e| e.to_string())?;

    let title_size = 18.0;
    let header_size = 14.0;
    let body_size = 11.0;
    let small_size = 9.0;

    let margin_left = Mm(20.0);
    let _margin_right = Mm(190.0);
    let page_width = Mm(170.0); // 210 - 20 - 20
    let mut current_y = Mm(270.0); // Start near top
    let line_height = Mm(5.0);

    // Helper function to add text and handle page breaks
    let add_text = |layer: &PdfLayerReference,
                    text: &str,
                    font: IndirectFontRef,
                    size: f64,
                    x: Mm,
                    y: &mut Mm,
                    _bold: bool|
     -> Result<(), String> {
        if *y < Mm(30.0) {
            // Need new page
            return Ok(()); // For simplicity, we'll truncate for now
        }

        layer.use_text(text, size as f32, x, *y, &font);
        *y = *y - line_height;
        Ok(())
    };

    // Title
    add_text(
        &current_layer,
        &conversation.title,
        helvetica_bold.clone(),
        title_size,
        margin_left,
        &mut current_y,
        true,
    )
    .map_err(|e| format!("Failed to add title: {}", e))?;

    current_y = current_y - line_height;

    // Metadata
    let metadata_text = format!(
        "Provider: {} | Model: {}",
        conversation.provider, conversation.model
    );
    add_text(
        &current_layer,
        &metadata_text,
        helvetica.clone(),
        body_size,
        margin_left,
        &mut current_y,
        false,
    )
    .map_err(|e| format!("Failed to add metadata: {}", e))?;

    let created_text = format!(
        "Created: {}",
        chrono::DateTime::from_timestamp(conversation.created_at / 1000, 0)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S UTC").to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    );
    add_text(
        &current_layer,
        &created_text,
        helvetica.clone(),
        body_size,
        margin_left,
        &mut current_y,
        false,
    )
    .map_err(|e| format!("Failed to add creation date: {}", e))?;

    current_y = current_y - line_height * 2.0;

    // Messages
    for (_index, msg) in messages.iter().enumerate() {
        if current_y < Mm(50.0) {
            // Not enough space for message, should create new page
            break; // For simplicity, truncate
        }

        let role_text = match msg.role.as_str() {
            "user" => "👤 User",
            "assistant" => "🤖 Assistant",
            "system" => "⚙️ System",
            _ => &msg.role,
        };

        // Role header
        add_text(
            &current_layer,
            role_text,
            helvetica_bold.clone(),
            header_size,
            margin_left,
            &mut current_y,
            true,
        )
        .map_err(|e| format!("Failed to add role header: {}", e))?;

        // Message content (simplified - just first 500 chars)
        let content = if msg.content.len() > 500 {
            format!("{}...", &msg.content[..497])
        } else {
            msg.content.clone()
        };

        // Split content into lines that fit the page width
        let words: Vec<&str> = content.split_whitespace().collect();
        let mut current_line = String::new();

        for word in words {
            let test_line = if current_line.is_empty() {
                word.to_string()
            } else {
                format!("{} {}", current_line, word)
            };

            // Rough estimation: assume each character is about 0.6mm wide
            if test_line.len() as f64 * 0.6 > page_width.0 as f64 {
                if !current_line.is_empty() {
                    add_text(
                        &current_layer,
                        &current_line,
                        helvetica.clone(),
                        body_size,
                        margin_left,
                        &mut current_y,
                        false,
                    )
                    .map_err(|e| format!("Failed to add content line: {}", e))?;
                    current_line = word.to_string();
                } else {
                    // Single word is too long, truncate it
                    current_line = format!("{}...", &word[..word.len().min(50)]);
                }
            } else {
                current_line = test_line;
            }

            if current_y < Mm(30.0) {
                break; // Page full
            }
        }

        if !current_line.is_empty() && current_y >= Mm(30.0) {
            add_text(
                &current_layer,
                &current_line,
                helvetica.clone(),
                body_size,
                margin_left,
                &mut current_y,
                false,
            )
            .map_err(|e| format!("Failed to add final content line: {}", e))?;
        }

        // Token count if available
        if let Some(tokens) = msg.tokens_used {
            let token_text = format!("Tokens used: {}", tokens);
            add_text(
                &current_layer,
                &token_text,
                helvetica.clone(),
                small_size,
                margin_left,
                &mut current_y,
                false,
            )
            .map_err(|e| format!("Failed to add token count: {}", e))?;
        }

        current_y = current_y - line_height;

        if current_y < Mm(30.0) {
            break; // No more space
        }
    }

    // Export timestamp
    current_y = Mm(20.0);
    let export_text = format!(
        "Exported on {}",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );
    add_text(
        &current_layer,
        &export_text,
        helvetica.clone(),
        small_size,
        margin_left,
        &mut current_y,
        false,
    )
    .map_err(|e| format!("Failed to add export timestamp: {}", e))?;

    // Save to bytes
    let mut buffer = Vec::new();
    doc.save(&mut BufWriter::new(&mut buffer))
        .map_err(|e| format!("Failed to save PDF: {}", e))?;

    Ok(buffer)
}

#[tauri::command]
pub async fn save_export_file(
    app: tauri::AppHandle,
    content: String,
    filename: String,
) -> Result<String, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .set_file_name(&filename)
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    // Wait for the dialog to complete
    let file_path = rx.recv().unwrap();

    let file_path = file_path.ok_or_else(|| "User cancelled file save".to_string())?;
    let path = file_path
        .as_path()
        .ok_or_else(|| "Invalid file path".to_string())?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}
#[tauri::command]
pub fn import_conversations_json(
    db: State<'_, Database>,
    json_content: String,
) -> Result<String, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    let export_data: ExportData =
        serde_json::from_str(&json_content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let mut imported_count = 0;
    let mut skipped_count = 0;

    for conv in export_data.conversations {
        // Check if conversation already exists
        if Conversation::get_by_id(&conn, &conv.id)
            .map_err(|e| e.to_string())?
            .is_some()
        {
            skipped_count += 1;
            continue;
        }

        // Create conversation
        let conversation = NewConversationWithId {
            id: conv.id.clone(),
            title: conv.title,
            provider: conv.provider,
            model: conv.model,
            system_prompt: conv.system_prompt,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
        };

        Conversation::create_with_id(&conn, conversation)
            .map_err(|e| format!("Failed to create conversation {}: {}", conv.id, e))?;

        // Import messages
        for msg in conv.messages {
            let msg_id = msg.id.clone();
            let message = NewMessageWithId {
                id: msg.id,
                conversation_id: conv.id.clone(),
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                tokens_used: msg.tokens_used,
            };

            Message::create_with_id(&conn, message)
                .map_err(|e| format!("Failed to create message {}: {}", msg_id, e))?;
        }

        imported_count += 1;
    }

    Ok(format!(
        "Import completed: {} conversations imported, {} skipped (already exist)",
        imported_count, skipped_count
    ))
}

#[tauri::command]
pub async fn load_import_file(app: tauri::AppHandle) -> Result<String, String> {
    use std::sync::{Arc, Mutex};
    use std::thread;
    use std::time::Duration;
    use tauri_plugin_dialog::DialogExt;

    let result = Arc::new(Mutex::new(None));
    let result_clone = result.clone();

    app.dialog()
        .file()
        .add_filter("JSON files", &["json"])
        .pick_file(move |file_path| {
            let mut res = result_clone.lock().unwrap();
            *res = Some(file_path);
        });

    // Wait for the dialog to complete
    let file_path = loop {
        thread::sleep(Duration::from_millis(10));
        let res = result.lock().unwrap();
        if let Some(ref path_opt) = *res {
            break path_opt.clone();
        }
    };

    let file_path = file_path.ok_or_else(|| "User cancelled file selection".to_string())?;
    let path = file_path
        .as_path()
        .ok_or_else(|| "Invalid file path".to_string())?;

    std::fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn export_single_conversation_json(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<String, String> {
    export_conversations_json(db, Some(vec![conversation_id]))
}

#[tauri::command]
pub async fn save_single_conversation_export(
    app: tauri::AppHandle,
    conversation_id: String,
    format: String,
    title: String,
) -> Result<String, String> {
    let db = app.state::<Database>();

    let (content_result, extension): (Result<Vec<u8>, String>, &str) = match format.as_str() {
        "json" => {
            let content = export_single_conversation_json(db.clone(), conversation_id)?;
            (Ok(content.into_bytes()), "json")
        }
        "markdown" => {
            let content = export_conversation_markdown(db.clone(), conversation_id)?;
            (Ok(content.into_bytes()), "md")
        }
        "html" => {
            let content = export_conversation_html(db.clone(), conversation_id)?;
            (Ok(content.into_bytes()), "html")
        }
        "pdf" => {
            let content = export_conversation_pdf(db.clone(), conversation_id)?;
            (Ok(content), "pdf")
        }
        _ => return Err("Invalid format. Supported: json, markdown, html, pdf".to_string()),
    };

    let content_bytes = content_result.map_err(|e| format!("Failed to generate content: {}", e))?;

    let filename = format!(
        "{}_{}.{}",
        title
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            })
            .collect::<String>()
            .trim_end_matches('_'),
        chrono::Utc::now().format("%Y%m%d_%H%M%S"),
        extension
    );

    // Save binary content for PDF, text content for others
    save_export_file_bytes(app, content_bytes, filename).await
}

#[tauri::command]
pub async fn save_export_file_bytes(
    app: tauri::AppHandle,
    content: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .set_file_name(&filename)
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    // Wait for the dialog to complete
    let file_path = rx.recv().unwrap();

    let file_path = file_path.ok_or_else(|| "User cancelled file save".to_string())?;
    let path = file_path
        .as_path()
        .ok_or_else(|| "Invalid file path".to_string())?;

    std::fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}
