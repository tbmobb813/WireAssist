# Linux AI Assistant - User Guide

Welcome to the Linux AI Assistant! This comprehensive guide will help you get
the most out of this powerful desktop AI companion for Linux developers and users.

## 🆕 What's New - Recent Enhancements

**Advanced Organization & Productivity Features:**

- **Conversation Branching**: Create alternative conversation paths from any message
- **Smart Tagging System**: Organize conversations with color-coded tags
- **Workspace Templates**: Pre-configured settings for different project types
- **Advanced Search**: Powerful search with filters, suggestions, and saved searches
- **Message Editing**: Edit your previous messages (coming soon)
- **Usage Analytics**: Comprehensive insights into your AI usage patterns

**Enhanced Quick Wins Features:**

- **Slash Commands**: Quick actions with `/help`, `/docs`, `/export`, etc.
- **Document Search**: Full-text search across project files
- **Profile System**: Switch between different work environments
- **Enhanced Export**: Export to JSON, Markdown, HTML, and PDF formats
- **Global Shortcuts**: System-wide keyboard shortcuts for productivity

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Features](#core-features)
3. [Advanced Features](#advanced-features)
4. [Organization & Workflow](#organization--workflow)
5. [Search & Discovery](#search--discovery)
6. [Productivity Features](#productivity-features)
7. [Settings & Customization](#settings--customization)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

## Getting Started

### Installation

The Linux AI Assistant is available in multiple formats:

- **AppImage**: Universal Linux package (recommended for most distributions)
- **DEB**: For Debian/Ubuntu systems
- **RPM**: For Red Hat/Fedora systems
- **Flatpak**: Sandboxed installation

### First Launch

1. Launch the application from your application menu or directly from the file manager
2. The application will create a database and default settings on first run
3. A welcome window will guide you through initial setup
4. Configure your preferred AI provider (see [Provider Selection](#3-provider-selection))

### Initial Configuration

**Set Up Your AI Provider:**

- **Cloud Providers** (OpenAI, Anthropic, Gemini):
  - Add your API key in Settings
  - Choose your preferred model
  - Set usage preferences (token limits, etc.)

- **Local AI** (Ollama):
  - Ensure Ollama is running on your machine
  - Select "Local" provider and choose a model
  - Download models through the Model Manager

## Core Features

### 1. Chat Interface

The main chat area where you interact with AI models.

**Features:**

- Multi-line input with markdown support
- Real-time response streaming
- Copy individual responses with one click
- Paste from clipboard to quickly include context
- Clear conversation history with one action

**Keyboard Shortcuts:**

- `Enter` - Send message
- `Shift+Enter` - New line in input
- `Ctrl+A` - Select all in input
- `Ctrl+V` - Paste from clipboard

**Slash Commands:**

Type `/` in the chat input to access powerful shortcuts:

- `/clear` - Clear current conversation instantly
- `/export` - Export conversation with format selection (JSON, Markdown, HTML, PDF)
- `/new` - Start a new conversation
- `/help` - Show available commands and usage examples
- `/docs <query>` - Search project documents and files
- `/run <command>` - Execute terminal commands safely with AI analysis
- `/profile <name>` - Switch to a different conversation profile

**Tips:**

- Start typing `/` to see autocomplete suggestions
- Commands are processed instantly without sending to AI
- Use `/help` for detailed usage examples

### 2. Conversation Management

Keep your AI conversations organized and accessible.

**Features:**

- Create new conversations with topic-specific context
- Search conversations by content or date
- Pin important conversations for quick access
- Archive old conversations
- Delete conversations (with confirmation)

**Organization Tips:**

- Use descriptive names for conversations
- Start related topics in the same conversation for context continuity
- Archive completed discussions to keep active list manageable
- Use search to find specific conversations

### 2.5. Document Search & Project Integration

Search across your project files and documents instantly.

**Features:**

- **Full-text search** across 40+ file types (code, docs, configs)
- **Smart indexing** with ignore pattern support (.gitignore + custom)
- **Instant results** with file preview and content highlighting
- **Project awareness** - automatically detects project boundaries

**Supported File Types:**

- Source code: `.py`, `.js`, `.ts`, `.rs`, `.go`, `.c`, `.cpp`, `.java`
- Documentation: `.md`, `.txt`, `.rst`, `.adoc`
- Configuration: `.json`, `.yaml`, `.toml`, `.xml`, `.env`
- Web files: `.html`, `.css`, `.scss`

**How to Use:**

1. Use `/docs <query>` slash command for quick search
2. Use `Ctrl+Shift+F` global shortcut from anywhere
3. Click the document search icon in the chat interface
4. Search results show file path, matching content, and relevance

**Search Tips:**

- Use quotes for exact phrases: `"error handling"`
- Search by file type: `filetype:py async`
- Combine terms: `database connection error`
- Use wildcard patterns: `test_*.py`

### 3. Provider Selection

Hybrid routing: Choose between cloud and local AI providers.

**Available Providers:**

| Provider      | Models               | Speed       | Privacy | Cost      |
| ------------- | -------------------- | ----------- | ------- | --------- |
| OpenAI        | GPT-4, GPT-3.5, etc. | Very Fast   | Cloud   | Per-token |
| Anthropic     | Claude, etc.         | Fast        | Cloud   | Per-token |
| Google Gemini | Gemini Pro, etc.     | Very Fast   | Cloud   | Per-token |
| Ollama        | Llama, Mistral, etc. | Medium-Slow | Local   | Free      |

**Hybrid Routing:**

- Automatically route questions between local and cloud based on complexity
- Use local models for sensitive or repetitive tasks
- Fall back to cloud for complex reasoning
- Configure routing preferences in Settings

### 4. Model Management

Download and manage AI models for local processing.

**Ollama Integration:**

- One-click model download from popular repositories
- View model size, parameter count, and capabilities
- Remove models to free up disk space
- Set default model for quick access
- See model statistics (downloads, rating, etc.)

**Model Selection Criteria:**

- **7B models**: Fast, runs on modest hardware, good for general tasks
- **13B models**: Balanced speed/quality, recommended baseline
- **70B models**: High quality, requires significant RAM/VRAM

### 5. Export & Import

Share conversations and preserve your work with multiple formats.

**Export Formats:**

- **JSON**: Complete conversation with metadata (perfect for reimport and backups)
- **Markdown**: Clean, readable format for documentation and sharing
- **HTML**: Rich formatted document with styling and navigation
- **PDF**: Professional document format with proper typography

**Export Methods:**

- **Slash Command**: Type `/export` in chat for quick format selection
- **Individual Export**: Click export buttons (📄 JSON, 📝 Markdown) on conversation items
- **Bulk Export**: Export all conversations from Settings → Export
- **Global Shortcut**: Use `Ctrl+E` to export current conversation

**Export Features:**

- Choose from 4 professional formats
- Include/exclude metadata (timestamps, models used, etc.)
- Rich HTML styling with syntax highlighting
- Professional PDF layout with proper formatting
- Native file picker integration
- Preserved conversation structure

**Import Features:**

- Import conversations from JSON exports
- Merge imported conversations with existing ones
- Validate imported data before importing
- Handle duplicate conversations automatically
- Maintain original timestamps and IDs

### 6. Profile System

Organize conversations by context with intelligent profile management.

**What are Profiles?**

Profiles are conversation contexts that remember your project settings, preferences, and working environment. Perfect for separating work contexts like "React Development", "Python Projects", or "Research".

**Key Features:**

- **Context Isolation**: Each profile maintains separate conversation history
- **Custom Settings**: Profile-specific AI provider, model, and preferences
- **Quick Switching**: Switch profiles instantly with `/profile <name>` or `Ctrl+P`
- **Project Awareness**: Profiles can be linked to specific project directories
- **Memory System**: Profiles remember your working patterns and preferences

**Profile Management:**

- **Create**: Click "+" in profile selector or use Settings → Profiles
- **Switch**: Use dropdown, `/profile <name>` command, or global shortcut
- **Edit**: Modify profile settings, context, and preferences
- **Delete**: Remove profiles with confirmation (conversations preserved)

**Best Practices:**

- Create profiles for different projects or work contexts
- Use descriptive names like "Frontend Development" or "Data Analysis"
- Set appropriate AI models per profile (local for sensitive, cloud for complex)
- Leverage profile switching for context-specific conversations

**Profile Shortcuts:**

- `Ctrl+P` - Toggle profile selection menu
- `/profile <name>` - Switch to named profile instantly

## Workflow Guide

### Development Workflow

Perfect for coding assistance and troubleshooting.

**Example Workflow:**

1. Create new conversation: "Python Debugging"
2. Paste error traceback
3. Ask for root cause analysis
4. Get suggested fixes
5. Copy fixed code snippets directly
6. Export conversation for team reference

### Research Workflow

Organize research and findings systematically.

**Best Practices:**

- Create separate conversations for different aspects
- Use initial messages to set research context and goals
- Pin important findings
- Export to markdown for documentation
- Search across conversations for related information

### Learning Workflow

Use AI to accelerate your learning process.

**Effective Approach:**

- Start with conceptual overview
- Ask for step-by-step breakdowns
- Request real-world examples
- Export learning materials for reference
- Create follow-up conversations for deep dives

## Advanced Features

### Conversation Branching

Create alternative conversation paths from any message point to explore different solutions or approaches.

**How to Use Branching:**

1. **Find Your Branch Point**: Locate the message where you want to explore alternatives
2. **Create Branch**: Click the branch icon (🌿) on any message
3. **Name Your Branch**: Give it a descriptive title like "Alternative Solution" or "Debugging Approach"
4. **Continue Conversation**: The branch starts with the same context but allows different directions

**Branch Navigation:**

- **View Branches**: Branch indicators appear in the conversation list
- **Switch Between Branches**: Click on branch names to navigate
- **Branch Hierarchy**: See parent-child relationships in the UI
- **Branch Comparison**: Compare different approaches side-by-side

**Best Practices:**

- Branch before trying risky code changes
- Create branches for different architectural approaches
- Use branches to explore "what if" scenarios
- Name branches descriptively for easy identification

### Smart Tagging System

Organize your conversations with color-coded tags for better categorization and discovery.

**Creating and Managing Tags:**

1. **Add Tags**: Click the tag icon in conversation details
2. **Create New Tags**: Type a new tag name to create it instantly
3. **Choose Colors**: Assign colors to make tags visually distinctive
4. **Autocomplete**: Start typing to see existing tag suggestions

**Tag Organization:**

- **Color Coding**: Use colors to group related tags (blue for projects, green for learning, etc.)
- **Hierarchical Tags**: Use naming like "project:frontend" and "project:backend"
- **Tag Filtering**: Filter conversations by one or multiple tags
- **Search Integration**: Tags are fully integrated with advanced search

**Tag Strategies:**

- **Project Tags**: "react", "python", "database"
- **Topic Tags**: "debugging", "architecture", "performance"
- **Status Tags**: "in-progress", "completed", "archived"
- **Priority Tags**: "urgent", "important", "reference"

### Workspace Templates

Pre-configured settings and prompts for different types of projects and workflows.

**Built-in Templates:**

1. **React TypeScript Development**
   - Optimized for modern React projects
   - TypeScript-focused prompts and context
   - Common libraries and patterns

2. **Python Data Science**
   - ML/AI project configuration
   - Data analysis and visualization focus
   - Popular libraries (pandas, numpy, sklearn)

3. **DevOps Automation**
   - Infrastructure and deployment focus
   - Cloud services and containerization
   - CI/CD and automation tools

4. **Full-Stack Web Development**
   - Complete web application stack
   - Frontend and backend integration
   - Database design and APIs

5. **Mobile Development**
   - Cross-platform mobile apps
   - React Native, Flutter focus
   - Mobile-specific patterns

**Using Templates:**

1. **Select Template**: Choose from the template selector when creating conversations
2. **Customize Settings**: Modify AI model, provider, and system prompts
3. **Apply Template**: Template settings are applied to new conversations
4. **Save Custom**: Create your own templates from successful configurations

**Creating Custom Templates:**

1. **Template Dialog**: Open template creation from Settings
2. **Configure Details**: Name, description, category, and AI settings
3. **System Prompt**: Set context-specific prompts for the AI
4. **File Patterns**: Specify relevant file types and ignore patterns
5. **Save Template**: Make it available for future use

### Advanced Search & Discovery

Powerful search capabilities with comprehensive filtering and smart suggestions.

**Advanced Search Modal:**

- **Quick Access**: `Ctrl+Shift+F` or click the search icon
- **Comprehensive Filters**: Date ranges, providers, models, tags, message roles
- **Real-time Results**: See results update as you type
- **Result Highlighting**: Key terms highlighted in results
- **Jump to Message**: Click results to navigate directly to specific messages

**Search Filters:**

- **Date Range**: Custom date picker for time-based filtering
- **Providers**: Filter by OpenAI, Anthropic, Google, Ollama, etc.
- **Models**: Search within specific AI model conversations
- **Tags**: Multi-select tag filtering with visual chips
- **Message Role**: Filter by user messages vs AI responses
- **Content Type**: Search in titles, message content, or both

**Smart Suggestions:**

- **Recent Searches**: Quick access to your recent search terms
- **Tag Suggestions**: Discover relevant tags as you type
- **Conversation Suggestions**: Jump to recent conversations quickly
- **Search Templates**: Pre-built searches like "today", "last week", "python code"

**Search Tips:**

- Use quotes for exact phrases: `"error handling"`
- Combine tags: `tag:python tag:debugging`
- Search by date: `last week`, `today`, `2024-10`
- Filter by provider: `provider:openai error`

### Message Editing

Edit your previous messages to refine questions or fix typos.

**How to Edit Messages:**

1. **Start Editing**: Click the edit button (✏️) on any of your messages
2. **Make Changes**: Edit the text in the textarea that appears
3. **Save Changes**: Click the save button (✓) to update the message
4. **Cancel Editing**: Click the cancel button (✗) to discard changes

**Features:**

- **In-place Editing**: Edit messages directly in the conversation
- **Auto-resize Textarea**: Text input expands as you type
- **Save/Cancel Controls**: Clear options to save or discard changes
- **Context Preservation**: Conversation flow is maintained after edits
- **Success Feedback**: Visual confirmation when messages are updated

**Best Practices:**

- Edit messages to clarify your questions for better AI responses
- Fix typos or grammar to improve conversation quality
- Refine instructions to get more precise results
- Update questions based on new information or insights

### Usage Analytics Dashboard

Comprehensive insights into your AI usage patterns and productivity metrics.

**Analytics Overview:**

- **Access**: Settings → Analytics Dashboard
- **Real-time Data**: Live calculations from your conversation database
- **Visual Charts**: Interactive graphs and metrics
- **Date Ranges**: Analyze patterns over different time periods

**Key Metrics:**

1. **Conversation Statistics**
   - Total conversations created
   - Active vs archived conversations
   - Average messages per conversation

2. **Message Analysis**
   - Total messages sent and received
   - User vs AI message distribution
   - Most active conversation days

3. **Provider & Model Usage**
   - Distribution across different AI providers
   - Model preferences and usage patterns
   - Provider response times and reliability

4. **Tag Analysis**
   - Most frequently used tags
   - Tag distribution across conversations
   - Popular tag combinations

5. **Time Patterns**
   - Daily activity levels
   - Peak usage hours
   - Weekly and monthly trends

6. **Performance Insights**
   - Average response times
   - Token usage and efficiency
   - Conversation success patterns

**Using Analytics:**

- **Identify Patterns**: Understand your AI usage habits
- **Optimize Workflows**: Find most effective conversation patterns
- **Track Productivity**: Monitor your AI-assisted work patterns
- **Plan Resources**: Understand API usage for budgeting

## Organization & Workflow

### Conversation Management

**Organization Strategies:**

- **Naming Convention**: Use descriptive titles like "Project X - Database Design"
- **Tagging Strategy**: Consistent tag hierarchy for easy filtering
- **Archiving**: Archive completed projects to reduce clutter
- **Pinning**: Pin frequently referenced conversations

**Branching Workflows:**

- **Exploration**: Branch to explore different solutions
- **Comparison**: Create branches to compare approaches
- **Backup**: Branch before major changes or risky operations
- **Collaboration**: Share different branches with team members

### Template-Driven Development

**Project Setup:**

1. **Choose Template**: Select appropriate workspace template
2. **Customize Context**: Modify system prompts for specific needs
3. **Set Preferences**: Configure AI model and provider preferences
4. **Start Conversation**: Begin with template-optimized context

**Template Management:**

- **Built-in Templates**: Start with professional templates
- **Custom Creation**: Build templates for recurring project types
- **Template Sharing**: Export templates for team consistency
- **Template Evolution**: Update templates based on successful patterns

## Search & Discovery

### Finding Information Quickly

**Search Strategies:**

- **Keyword Search**: Use specific technical terms
- **Tag-based Discovery**: Browse conversations by topic
- **Date-based Filtering**: Find recent or historical conversations
- **Content-type Filtering**: Search only in titles or messages

**Advanced Search Techniques:**

- **Boolean Logic**: Combine terms with implicit AND operations
- **Tag Combinations**: `tag:react tag:typescript` for specific intersections
- **Provider Filtering**: Find conversations with specific AI models
- **Time-based Queries**: `last month`, `yesterday`, `2024-10-15`

### Cross-Reference Discovery

**Related Content:**

- **Tag Relationships**: Find related conversations through shared tags
- **Branch Exploration**: Follow conversation branches for alternative solutions
- **Search Suggestions**: Discover related terms and topics
- **Template Connections**: Find conversations created from similar templates

## Productivity Features

## Settings & Customization

### General Settings

**Theme:**

- Auto (follows system theme)
- Light
- Dark

**Appearance:**

- Font size adjustment
- Interface density (compact, normal, spacious)
- Enable/disable animations

### AI Provider Settings

**API Configuration:**

- OpenAI API Key: [Get from openai.com/api](https://platform.openai.com/api-keys)
- Anthropic API Key: [Get from claude.ai](https://claude.ai)
- Gemini API Key: [Get from ai.google.dev](https://ai.google.dev)
- Ollama Endpoint: Usually `http://localhost:11434`

**Model Preferences:**

- Default model for quick access
- Maximum tokens per response
- Temperature (creativity level, 0-2)
- Top-P sampling
- Frequency penalty

### Privacy & Data

**Data Retention:**

- Automatic deletion after X days (disabled by default)
- Clear all conversations
- Export before deletion
- Local-only processing option

**Privacy Mode:**

- Disable cloud logging
- Use only local models
- Encrypt sensitive conversations
- Don't include in analytics

### Keyboard & Hotkeys

**Global Shortcuts:**

The assistant includes a comprehensive global shortcut system with 12 configurable shortcuts organized by category:

**Window & Focus:**

- `Ctrl+Space` - Toggle main window visibility (default)
- `Ctrl+Shift+I` - Focus chat input field
- `Ctrl+Shift+Space` - Quick capture input without showing window

**Conversation:**

- `Ctrl+N` - Start new conversation
- `Ctrl+Delete` - Clear current conversation

**Export:**

- `Ctrl+E` - Export current conversation
- `Ctrl+Shift+E` - Quick export in default format

**Profiles:**

- `Ctrl+P` - Toggle profile selection menu

**Search:**

- `Ctrl+Shift+F` - Open document search interface

**System:**

- `Ctrl+Comma` - Open settings panel
- `Ctrl+Shift+P` - Show performance metrics

**Recording:**

- `Ctrl+R` - Toggle voice recording (when available)

**Customization:**

- All shortcuts are configurable in Settings → Global Shortcuts
- Shortcuts are organized by category for easy management
- Conflict detection prevents duplicate key bindings
- Real-time shortcut capture for easy configuration

## Advanced Features

### Project Context Integration

The assistant can analyze your project structure and recent changes.

**Enabling Project Context:**

1. Open Settings → Project Integration
2. Select your project root directory
3. Enable "Watch for Changes"
4. Optionally enable Git integration

**Benefits:**

- Automatic project structure awareness
- Detect recent file changes
- Analyze git diffs for context
- Better code review assistance
- Faster debugging with current codebase context

### Terminal Integration

Safely execute terminal commands with AI analysis and error handling.

**Features:**

- **Safe Command Execution**: Commands are validated before execution
- **AI Error Analysis**: Automatic analysis of command output and errors
- **Command History**: Track and learn from previous command executions
- **Project Context**: Commands are aware of your current project structure

**How to Use:**

1. **Slash Command**: Type `/run <command>` in chat
2. **CLI Tool**: Use `linux-ai-assistant capture "command"` from terminal
3. **Security Validation**: Dangerous commands are flagged and require confirmation

**Examples:**

```bash
/run npm test                    # Run tests with AI analysis
/run git status                  # Check git status
/run pip install requests        # Install Python package
/run grep -r "TODO" src/         # Search for TODO comments
```

**Safety Features:**

- Command validation prevents dangerous operations
- Sandbox environment for untrusted commands
- User confirmation for destructive actions
- Error pattern recognition and suggestions
- Integration with project .gitignore for safe file operations

**CLI Integration:**

The companion CLI tool provides additional terminal capture capabilities:

```bash
# Install CLI tool (from project root)
cd linux-ai-assistant/cli && cargo build --release

# Capture command output with AI analysis
linux-ai-assistant capture "npm run build"
linux-ai-assistant capture "python test.py" --analyze
```

### Code Execution & Testing

Run code snippets and see results directly.

**Supported Languages:**

- Python
- JavaScript/Node.js
- Bash/Shell
- And more via extensibility

**Safety Features:**

- Sandboxed execution environment
- Resource limits (CPU, memory, time)
- No permanent file system access (unless explicitly allowed)
- Execution audit trail

**Usage:**

1. AI generates code in markdown block with language tag
2. "Run" button appears automatically
3. Click to execute in sandboxed environment
4. See output directly in chat
5. Save useful snippets for later

### Terminal Integration

Execute commands suggested by AI with safety checks.

**Features:**

- AI suggests terminal commands
- Review before execution
- Syntax highlighting and explanation
- Command execution history
- Error handling and recovery

### Search & Knowledge Base

Full-text search across all conversations.

**Search Features:**

- Quick search with `Ctrl+F`
- Advanced search with filters:
  - Date range
  - Provider/Model used
  - Conversation topic
  - Message author (you or assistant)
- Regular expression support
- Save frequent searches

## Troubleshooting

### Connection Issues

**Problem: "Cannot connect to AI provider"**

**Solutions:**

1. Check internet connection
2. Verify API key is correct
3. Ensure API account is active and has credits
4. Try different provider if available
5. For local: Ensure Ollama is running (`ollama serve`)

**Problem: "Local model (Ollama) not responding"**

**Solutions:**

1. Check Ollama is running: `ollama serve` in terminal
2. Verify connection address: Usually `http://localhost:11434`
3. Restart Ollama service
4. Check firewall settings
5. Ensure sufficient disk space for model

### Performance Issues

**Problem: "Application feels slow"**

**Solutions:**

1. Close other applications to free memory
2. Disable animations in Settings
3. Use local models for faster responses (if appropriate)
4. Clear conversation history (Settings → Data → Clear All)
5. Restart the application

**Problem: "Large file imports/exports hang"**

**Solutions:**

1. Check available disk space
2. Use smaller export batches (export single conversations)
3. Restart application
4. Check system resources
5. Try again with fewer conversations

### Response Issues

**Problem: "Responses are too brief or off-topic"**

**Solutions:**

1. Provide more context in your question
2. Use multi-turn conversations to build context
3. Adjust model temperature (higher = more creative)
4. Try a different model
5. Clear conversation and start fresh

**Problem: "Getting repetitive or stuck responses"**

**Solutions:**

1. Start a new conversation
2. Clarify your question differently
3. Reduce temperature setting
4. Use a more capable model (GPT-4 vs 3.5)
5. Add more specific constraints

### Data Issues

**Problem: "Conversations are disappearing"**

**Solutions:**

1. Check if auto-delete is enabled (Settings → Privacy)
2. Check if conversations were archived (not deleted)
3. Check export files (may have been exported)
4. Restore from backup if available
5. Check application database health

**Problem: "Cannot import conversations"**

**Solutions:**

1. Verify JSON format is valid
2. Check file is not corrupted
3. Ensure sufficient disk space
4. Try importing smaller files first
5. Check file permissions

## FAQ

### Q: Is my data private?

**A:** Your conversations are stored locally in the application database. Cloud provider responses may be processed by their servers according to their privacy policies. You can use local models (Ollama) for completely private processing.

### Q: Can I use this offline?

**A:** Yes! With Ollama, you can run models completely offline on your machine. Cloud providers require internet access.

### Q: What are the hardware requirements?

**A:**

- **Minimum**: 4GB RAM, 2GB disk space
- **Recommended for local models**: 8GB+ RAM, 20GB+ disk space (depending on model size)
- **GPU**: Optional but recommended for faster local inference

### Q: How much does it cost?

**A:** The application is free. Cloud provider usage depends on their pricing (typically per-token billing). Local models (Ollama) are free.

### Q: Can I export my data?

**A:** Yes! Export conversations as JSON (for reimport) or Markdown (for sharing/publishing).

### Q: How do I update the application?

**A:** The application checks for updates on launch. When available, you'll see an update notification. Click to download and install automatically.

### Q: Can I use multiple AI providers in one conversation?

**A:** Currently, each message uses the selected provider. You can switch providers between messages to compare responses.

### Q: Is there a CLI companion?

**A:** Yes! The `lai` CLI companion tool is included. See [CLI Documentation](CLI_GUIDE.md) for details.

### Q: How do I report bugs or suggest features?

**A:** Visit the GitHub repository or contact support. Include:

- Application version
- Reproduction steps
- Error messages or logs
- System information

### Q: Can I customize keyboard shortcuts?

**A:** Yes, visit Settings → Keyboard & Hotkeys to customize shortcuts and the global hotkey.

### Q: How do I backup my conversations?

**A:** Use Settings → Data → Export All to backup all conversations. Recommended monthly or before major updates.

## Getting Help

- **In-App Help**: Press `F1` or click Help menu
- **Documentation**: Check User Guide (this file)
- **Troubleshooting**: See Troubleshooting Guide
- **CLI Guide**: See CLI_GUIDE.md for command-line usage
- **Developer Guide**: See DEVELOPER_GUIDE.md for API documentation

## Tips & Tricks

1. **Use system theme detection** - Automatically matches your desktop theme
2. **Keyboard-first workflow** - Most actions have keyboard shortcuts
3. **Search is powerful** - Use regex patterns for advanced searching
4. **Export regularly** - Build a library of useful conversations
5. **Experiment with providers** - Different models excel at different tasks
6. **Leverage project context** - Enables more accurate assistance
7. **Pin important conversations** - Quick access to critical information

---

**Version**: 1.0  
**Last Updated**: October 2025  
**Support**: See GitHub repository for support and feedback
