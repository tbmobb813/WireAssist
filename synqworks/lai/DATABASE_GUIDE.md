# Complete Database Layer Setup Guide

## Overview

This guide will walk you through setting up the complete database layer for your Linux AI Assistant, including both backend (Rust) and frontend (TypeScript) integration.

## Prerequisites

✅ You've run the initial setup script  
✅ You have VS Code installed (optional but recommended)  
✅ Your project is at `linux-ai-assistant/`

---

## Step 1: Update Cargo.toml Dependencies

Open `src-tauri/Cargo.toml` and ensure you have these dependencies:

```toml
[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
tauri-plugin-notification = "2.0"
tauri-plugin-global-shortcut = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1.8", features = ["v4", "serde"] }
```

---

## Step 2: Create Database Module Structure

Create the following directory structure:

```bash
cd linux-ai-assistant
mkdir -p src-tauri/src/database
mkdir -p src-tauri/src/commands
```

Now create these files with the code from the artifacts:

### Backend Files (Rust):

1. **src-tauri/src/database/mod.rs** - Main database module
2. **src-tauri/src/database/schema.rs** - Database schema
3. **src-tauri/src/database/conversations.rs** - Conversation operations
4. **src-tauri/src/database/messages.rs** - Message operations
5. **src-tauri/src/database/settings.rs** - Settings operations
6. **src-tauri/src/commands/mod.rs** - Commands module exports
7. **src-tauri/src/commands/conversations.rs** - Conversation commands
8. **src-tauri/src/commands/messages.rs** - Message commands
9. **src-tauri/src/commands/settings.rs** - Settings commands
10. **src-tauri/src/main.rs** - Updated main file

### Frontend Files (TypeScript):

1. **src/lib/api/types.ts** - TypeScript types
2. **src/lib/api/database.ts** - Database API wrapper
3. **src/lib/stores/chatStore.ts** - Chat state management
4. **src/lib/stores/settingsStore.ts** - Settings state management

---

## Step 3: Set Up VS Code (Recommended)

If using VS Code, create these configuration files:

```bash
mkdir -p .vscode
```

Create the following files from the VS Code artifact:

1. **.vscode/settings.json** - Workspace settings
2. **.vscode/extensions.json** - Recommended extensions
3. **.vscode/launch.json** - Debug configurations
4. **.vscode/tasks.json** - Build tasks
5. **.prettierrc** - Code formatting
6. **.eslintrc.cjs** - Linting rules

### Install VS Code Extensions

Open VS Code and install the recommended extensions:

- Press `Ctrl+Shift+P`
- Type "Extensions: Show Recommended Extensions"
- Install all recommended extensions

Key extensions:

- **rust-analyzer** - Rust language support
- **Tauri** - Tauri development tools
- **Prettier** - Code formatting
- **ESLint** - JavaScript/TypeScript linting
- **Tailwind CSS IntelliSense** - Tailwind autocomplete

---

## Step 4: Build the Backend

Navigate to your project and build the Rust backend:

```bash
cd linux-ai-assistant

# Check for compilation errors
cargo check --manifest-path=./src-tauri/Cargo.toml

# Build in development mode
cargo build --manifest-path=./src-tauri/Cargo.toml
```

If you get any errors, they'll typically be:

- Missing dependencies → Run `cargo build` again
- Syntax errors → Check the file content matches the artifacts
- Module not found → Ensure all `mod.rs` files exist

---

## Step 5: Test the Database

Create a simple test file to verify the database works:

**src-tauri/src/database/tests.rs**:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use std::path::PathBuf;

    #[test]
    fn test_database_creation() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_db.db");

        let db = Database::new(db_path.clone()).unwrap();
        assert!(db_path.exists());

        // Cleanup
        std::fs::remove_file(db_path).ok();
    }
}
```

Run tests:

```bash
cargo test --manifest-path=./src-tauri/Cargo.toml
```

---

## Step 6: Update Frontend Dependencies

Install Zustand if not already installed:

```bash
npm install zustand
```

---

## Step 7: Test the Full Stack

Now let's test that everything works together:

### Update App.tsx

Replace your `src/App.tsx` with this test version:

```typescript
import { useEffect, useState } from "react";
import { useChatStore } from "./lib/stores/chatStore";
import { useSettingsStore } from "./lib/stores/settingsStore";

function App() {
  const [message, setMessage] = useState("");

  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
  } = useChatStore();

  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    // Load initial data
    loadSettings();
    loadConversations();
  }, []);

  const handleCreateNew = async () => {
    await createConversation("New Conversation", "gpt-4", "openai");
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !currentConversation) return;
    await sendMessage(message);
    setMessage("");
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <button
          onClick={handleCreateNew}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg mb-4"
        >
          New Conversation
        </button>

        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                currentConversation?.id === conv.id
                  ? "bg-gray-700"
                  : "hover:bg-gray-700"
              }`}
            >
              <div className="font-medium truncate">{conv.title}</div>
              <div className="text-xs text-gray-400">{conv.model}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">
            {currentConversation?.title || "Linux AI Assistant"}
          </h1>
          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentConversation ? (
            messages.length > 0 ? (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-600 ml-12"
                      : "bg-gray-800 mr-12"
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">
                    {msg.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 mt-8">
                No messages yet. Start the conversation!
              </div>
            )
          ) : (
            <div className="text-center text-gray-400 mt-8">
              Select a conversation or create a new one
            </div>
          )}

          {isLoading && (
            <div className="text-center text-gray-400">
              <div className="animate-pulse">Processing...</div>
            </div>
          )}
        </div>

        {/* Input */}
        <footer className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message..."
              disabled={!currentConversation || isLoading}
              className="flex-1 px-4 py-2 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!currentConversation || isLoading || !message.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
```

---

## Step 8: Run the Application

Start the development server:

```bash
npm run tauri dev
```

The application should:

1. Open in a new window
2. Show an empty sidebar (no conversations yet)
3. Allow you to click "New Conversation"
4. Show the new conversation in the sidebar
5. Let you type and send messages
6. Store everything in the database

---

## Step 9: Verify Database is Working

### Check the Database File

The database is created at:

```bash
# On Linux
~/.local/share/com.linuxai.assistant/database.db
```

You can inspect it with sqlite3:

```bash
sudo apt install sqlite3
sqlite3 ~/.local/share/com.linuxai.assistant/database.db

# Run SQL commands
.tables
SELECT * FROM conversations;
SELECT * FROM messages;
.quit
```

---

## Troubleshooting

### Common Issues:

**1. "Failed to initialize database"**

- Check file permissions on the app data directory
- Ensure rusqlite is properly installed: `cargo build`

**2. "invoke command not found"**

- Verify command is registered in `main.rs`
- Check command name matches between Rust and TypeScript

**3. TypeScript errors in VS Code**

- Run: `npm install`
- Restart VS Code
- Check `@tauri-apps/api` is installed

**4. Rust compilation errors**

- Run: `cargo clean --manifest-path=./src-tauri/Cargo.toml`
- Rebuild: `cargo build --manifest-path=./src-tauri/Cargo.toml`

**5. Hot reload not working**

- Restart dev server
- Check vite config is correct

---

## Next Steps

Now that your database layer is working, you can:

1. **Add AI Provider Integration** - Connect to OpenAI, Anthropic, etc.
2. **Improve UI** - Add better message formatting, code highlighting
3. **Add Search** - Implement full-text search for messages
4. **Export/Import** - Add conversation export functionality
5. **Settings Panel** - Create UI for managing API keys and preferences

---

## VS Code Keyboard Shortcuts

Useful shortcuts for development:

- **Ctrl+Shift+B** - Run build task
- **F5** - Start debugging
- **Ctrl+`** - Toggle terminal
- **Ctrl+P** - Quick file open
- **Ctrl+Shift+F** - Search in files
- **Ctrl+/** - Toggle comment

---

## Development Workflow

Recommended workflow in VS Code:

1. Open integrated terminal (Ctrl+`)
2. Split terminal (click the split icon)
3. In terminal 1: `npm run dev` (keeps Vite running)
4. In terminal 2: `cargo tauri dev` (runs app)
5. Edit files - changes auto-reload
6. Use rust-analyzer for Rust autocomplete
7. Use TypeScript IntelliSense for frontend

---

## Testing Your Changes

After making changes:

### Frontend Changes:

- Save file → Vite auto-reloads → See changes immediately

### Backend Changes:

- Save file → Tauri rebuilds → App restarts automatically

### Database Schema Changes:

- Delete the database file
- Restart app to recreate with new schema

---

## Success Checklist

✅ Database files created in the right locations  
✅ Conversations can be created and listed  
✅ Messages can be sent and retrieved  
✅ Settings are persisted  
✅ No console errors  
✅ VS Code extensions working  
✅ Hot reload functioning

If all items are checked, your database layer is fully operational!
