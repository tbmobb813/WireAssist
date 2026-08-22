use rusqlite::{Connection, Result};

pub fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            system_prompt TEXT,
            deleted INTEGER NOT NULL DEFAULT 0,
            deleted_at INTEGER,
            parent_conversation_id TEXT,
            branch_point_message_id TEXT,
            FOREIGN KEY (parent_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
            FOREIGN KEY (branch_point_message_id) REFERENCES messages(id) ON DELETE SET NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            tokens_used INTEGER,
            deleted INTEGER NOT NULL DEFAULT 0,
            deleted_at INTEGER,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_conversation
         ON messages(conversation_id, timestamp)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_updated
         ON conversations(updated_at DESC)",
        [],
    )?;

    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
         USING fts5(content, conversation_id, tokenize='porter')",
        [],
    )?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS messages_fts_insert
         AFTER INSERT ON messages
         BEGIN
            INSERT INTO messages_fts(rowid, content, conversation_id)
            VALUES (NEW.rowid, NEW.content, NEW.conversation_id);
         END",
        [],
    )?;

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS messages_fts_delete
         AFTER DELETE ON messages
         BEGIN
            DELETE FROM messages_fts WHERE rowid = OLD.rowid;
         END",
        [],
    )?;

    // Create profiles table for basic profile system
    conn.execute(
        "CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            default_model TEXT NOT NULL,
            default_provider TEXT NOT NULL,
            system_prompt TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    // Add index for active profile lookup
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_profiles_active
         ON profiles(is_active DESC, updated_at DESC)",
        [],
    )?;

    // Create default profile if no profiles exist
    conn.execute(
        "INSERT OR IGNORE INTO profiles (
            id, name, description, default_model, default_provider,
            system_prompt, created_at, updated_at, is_active
        )
        SELECT
            'default', 'Default', 'Default conversation profile',
            'gpt-4o-mini', 'openai', NULL,
            strftime('%s', 'now') * 1000,
            strftime('%s', 'now') * 1000,
            1
        WHERE NOT EXISTS (SELECT 1 FROM profiles)",
        [],
    )?;

    // Add branching columns to existing conversations table if they don't exist
    conn.execute(
        "ALTER TABLE conversations ADD COLUMN parent_conversation_id TEXT
         REFERENCES conversations(id) ON DELETE SET NULL",
        [],
    )
    .ok(); // Ignore error if column already exists

    conn.execute(
        "ALTER TABLE conversations ADD COLUMN branch_point_message_id TEXT
         REFERENCES messages(id) ON DELETE SET NULL",
        [],
    )
    .ok(); // Ignore error if column already exists

    // Create index for conversation hierarchy
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_parent
         ON conversations(parent_conversation_id)",
        [],
    )?;

    // Create tags table for conversation tagging
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Create conversation_tags junction table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conversation_tags (
            conversation_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (conversation_id, tag_id),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create indexes for efficient tag queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversation_tags_conversation
         ON conversation_tags(conversation_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag
         ON conversation_tags(tag_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tags_name
         ON tags(name)",
        [],
    )?;

    // Create workspace templates table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspace_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            default_model TEXT NOT NULL,
            default_provider TEXT NOT NULL,
            system_prompt TEXT,
            settings_json TEXT,
            ignore_patterns TEXT,
            file_extensions TEXT,
            context_instructions TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            is_builtin INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    // Create index for template categories
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_templates_category
         ON workspace_templates(category)",
        [],
    )?;

    // Insert built-in templates if they don't exist
    conn.execute(
        "INSERT OR IGNORE INTO workspace_templates (
            id, name, description, category, default_model, default_provider,
            system_prompt, settings_json, ignore_patterns, file_extensions,
            context_instructions, created_at, updated_at, is_builtin
        )
        VALUES 
        -- React Development Template
        ('builtin-react', 'React Development', 'Template for React.js/Next.js projects', 'frontend',
         'gpt-4o-mini', 'openai',
         'You are an expert React developer. You help with React components, hooks, state management, and modern JavaScript/TypeScript development. Focus on best practices, clean code, and performance optimization.',
         '{\"fileWatcher\": true, \"autoSave\": true, \"formatOnSave\": true}',
         'node_modules,dist,build,.next,.cache,coverage,*.log',
         '.js,.jsx,.ts,.tsx,.json,.md,.css,.scss',
         'When analyzing React projects, focus on component structure, props flow, state management patterns, and performance considerations. Always suggest modern React patterns like hooks and functional components.',
         strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 1),
        
        -- Python Development Template  
        ('builtin-python', 'Python Development', 'Template for Python projects and data science', 'backend',
         'gpt-4o-mini', 'openai',
         'You are an expert Python developer specializing in clean code, best practices, and modern Python development. You help with frameworks like Django, Flask, FastAPI, and data science libraries.',
         '{\"fileWatcher\": true, \"autoSave\": true, \"linting\": true}',
         '__pycache__,.venv,venv,.pytest_cache,*.pyc,*.pyo,*.egg-info,dist,build',
         '.py,.pyx,.pyi,.ipynb,.txt,.md,.yml,.yaml,.toml,.cfg,.ini',
         'When working with Python code, emphasize type hints, proper error handling, testing patterns, and adherence to PEP 8. Consider performance implications and suggest appropriate libraries.',
         strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 1),
        
        -- Rust Development Template
        ('builtin-rust', 'Rust Development', 'Template for Rust systems programming', 'systems',
         'gpt-4o-mini', 'openai',
         'You are an expert Rust developer focused on safe, fast, and concurrent systems programming. You help with ownership, borrowing, error handling, and Rust ecosystem crates.',
         '{\"fileWatcher\": true, \"autoSave\": true, \"cargoIntegration\": true}',
         'target,Cargo.lock,*.lock,*.orig,.cargo',
         '.rs,.toml,.md,.yml,.yaml',
         'When analyzing Rust code, focus on memory safety, ownership patterns, error handling with Result/Option, and efficient use of the type system. Suggest idiomatic Rust solutions.',
         strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 1),
        
        -- DevOps Template
        ('builtin-devops', 'DevOps & Infrastructure', 'Template for infrastructure and deployment', 'devops',
         'gpt-4o-mini', 'openai',
         'You are a DevOps expert specializing in cloud infrastructure, CI/CD, containerization, and automation. You help with Docker, Kubernetes, cloud platforms, and infrastructure as code.',
         '{\"fileWatcher\": true, \"autoSave\": true, \"cloudIntegration\": true}',
         'node_modules,.terraform,.vagrant,logs,*.log,*.tmp',
         '.yml,.yaml,.json,.tf,.dockerfile,.sh,.ps1,.md',
         'Focus on scalability, security, monitoring, and automation. Consider infrastructure patterns, deployment strategies, and operational best practices.',
         strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 1),
        
        -- General Purpose Template
        ('builtin-general', 'General Purpose', 'Flexible template for any project type', 'general',
         'gpt-4o-mini', 'openai',
         'You are a helpful programming assistant with broad knowledge across multiple languages and technologies. Adapt your expertise to the specific project context and requirements.',
         '{\"fileWatcher\": false, \"autoSave\": true}',
         '.git,.svn,.hg,node_modules,*.log,*.tmp,.DS_Store',
         '*',
         'Analyze the project context and adapt your responses to the specific technology stack and requirements. Provide clear, practical solutions.',
         strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 1)
        ",
        [],
    )?;

    Ok(())
}
