# Linux AI Assistant - Complete Documentation Index

Welcome to the Linux AI Assistant documentation! This comprehensive resource
covers everything from getting started to advanced development.

## 📚 Documentation Overview

### For End Users

**[User Guide](USER_GUIDE.md)** - START HERE

- Getting started and installation
- Core features walkthrough
- Workflow guides for different use cases
- Settings and customization options
- Advanced features (project context, code execution, etc.)
- FAQ and tips & tricks

**[CLI Guide](CLI_GUIDE.md)** - Command-Line Usage

- CLI installation and setup
- Basic and advanced commands
- Integration with shell scripts and development workflows
- Performance optimization
- Configuration and environment variables
- Practical examples and aliases

**[Troubleshooting Guide](TROUBLESHOOTING.md)** - Problem Solving

- Common issues and solutions
- Network and connection problems
- Performance optimization
- Model and provider issues
- Data storage and backup
- UI and display problems
- Debug information collection

### For Developers

**[Developer Guide](DEVELOPER_GUIDE.md)** - Development Documentation

- Architecture overview
- Database schema and design
- Backend API reference
- Frontend components and state management
- Extension development
- Building and deployment
- Testing and debugging

### Quick Navigation

| Need Help With          | Go To                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| Getting started         | [User Guide → Getting Started](USER_GUIDE.md#getting-started)         |
| Using the chat          | [User Guide → Chat Interface](USER_GUIDE.md#1-chat-interface)         |
| Local AI models         | [User Guide → Provider Selection](USER_GUIDE.md#3-provider-selection) |
| Exporting conversations | [User Guide → Export & Import](USER_GUIDE.md#5-export--import)        |
| Command-line usage      | [CLI Guide](CLI_GUIDE.md)                                             |
| Fixing issues           | [Troubleshooting Guide](TROUBLESHOOTING.md)                           |
| API development         | [Developer Guide](DEVELOPER_GUIDE.md)                                 |
| Contributing code       | [Developer Guide → Contributing](DEVELOPER_GUIDE.md#contributing)     |

## 🚀 Quick Start Guide

### 1. Installation (5 minutes)

```bash
# Download the application for your Linux distribution
# From: https://github.com/tbmobb813/Linux-AI-Assistant/releases

# For AppImage
chmod +x linux-ai-assistant*.AppImage
./linux-ai-assistant*.AppImage

# For Debian/Ubuntu
sudo apt install ./linux-ai-assistant*.deb

# For Fedora/RHEL
sudo rpm -i linux-ai-assistant*.rpm
```

### 2. Initial Setup (2 minutes)

1. Launch the application
2. Go to **Settings** → **AI Provider**
3. Choose your provider:
   - **Cloud**: Add API key (OpenAI, Anthropic, or Gemini)
   - **Local**: Use Ollama for private processing
4. Select a model
5. Click "Test Connection"

### 3. Your First Conversation (1 minute)

1. Type a question in the chat box
2. Press **Enter** or click **Send**
3. Watch AI respond in real-time
4. Copy responses or continue the conversation

That's it! You're ready to use the Linux AI Assistant.

## 📖 Common Tasks

### I want to

### Use AI for coding help

- Create a new conversation titled "Python Help"
- Paste code or describe the problem
- Get suggestions and explanations
- Copy fixed code directly
- Use `/docs` to search project documentation
- Use `/run` to test commands safely
- See: [User Guide → Development Workflow](USER_GUIDE.md#development-workflow)

### Keep conversations private

- Use Ollama with local models
- No internet required, no data leaves your computer
- See: [User Guide → Provider Selection](USER_GUIDE.md#3-provider-selection)

### Export my conversations

- Click the export icon or use `/export` slash command
- Choose from 4 formats: JSON, Markdown, HTML, PDF
- Use global shortcut `Ctrl+E` for quick export
- See: [User Guide → Export & Import](USER_GUIDE.md#5-export--import)

### Search project files

- Use `/docs <query>` slash command
- Use `Ctrl+Shift+F` global shortcut
- Search across 40+ file types with full-text search
- See: [User Guide → Document Search](USER_GUIDE.md#25-document-search--project-integration)

### Organize with profiles

- Create profiles for different projects or contexts
- Switch with `/profile <name>` or `Ctrl+P`
- Separate conversation history and settings per profile
- See: [User Guide → Profile System](USER_GUIDE.md#6-profile-system)

### Use keyboard shortcuts

- 12 configurable global shortcuts across categories
- `Ctrl+Space` to toggle window, `Ctrl+E` to export
- Customize all shortcuts in Settings → Global Shortcuts
- See: [User Guide → Keyboard & Hotkeys](USER_GUIDE.md#keyboard--hotkeys)

### Use the command line

- Install CLI companion tool
- Use `lai` commands in your terminal
- Use `lai capture` for safe command execution with AI analysis
- Integrate with scripts and workflows
- See: [CLI Guide](CLI_GUIDE.md)

### Debug a problem

- Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
- Collect debug information
- Search for your issue
- Submit detailed bug report if needed

### Contribute code\*\*

- Fork the repository
- Follow development setup in [Developer Guide](DEVELOPER_GUIDE.md#setup-development-environment)
- Make changes and test
- Submit pull request

## 🎯 Feature Highlights

### 🤖 AI Capabilities

- Support for multiple AI providers (OpenAI, Anthropic, Google Gemini)
- Local AI with Ollama for privacy
- Hybrid routing between local and cloud
- Real-time streaming responses

### 🛡️ Privacy & Security

- Conversations stored locally
- Optional end-to-end encryption
- No mandatory cloud syncing
- Data retention control

### 🧠 Developer Features

- **Slash Commands**: 7 powerful shortcuts (`/docs`, `/run`, `/export`, etc.)
- **Document Search**: Full-text search across 40+ file types
- **Terminal Integration**: Safe command execution with AI analysis
- **Profile System**: Context-aware conversation management
- **Global Shortcuts**: 12 configurable system-wide shortcuts
- Project-aware context injection
- Git integration for code awareness
- CLI companion tool with capture capabilities

### 📚 Organization

- Conversation search and filtering
- Pin important conversations
- Archive for organization
- Profile-based organization
- Tag-based categorization (coming soon)
- Full-text search across all conversations

### 📤 Export & Sharing

- **4 Export Formats**: JSON, Markdown, HTML, PDF
- Individual and bulk export options
- Rich formatting with syntax highlighting
- Professional PDF layouts
- Native file picker integration

### ⚡ Performance

- 67% smaller binary size (9.7MB vs 29MB)
- Optimized bundle splitting
- Lazy loading of components
- Fast startup and response times

## 🔧 System Requirements

**Minimum:**

- OS: Linux (Ubuntu 20.04+, Fedora 35+, or equivalent)
- RAM: 4GB
- Storage: 2GB free space

**Recommended:**

- OS: Modern Linux distribution
- RAM: 8GB+
- Storage: 20GB+ (for local models)
- GPU: Recommended for faster local inference

**For Local AI (Ollama):**

- 8GB+ RAM
- 20GB+ disk space (model dependent)
- GPU optional but recommended

## 💡 Tips & Best Practices

### Maximizing Efficiency

1. **Use keyboard shortcuts** - Most actions have shortcuts
2. **Organize with tags** - Keep conversations findable
3. **Pin important talks** - Quick access to references
4. **Export regularly** - Build a knowledge library
5. **Use project context** - Enable for better assistance

### Saving Costs

1. Use local models (Ollama) when possible
2. Reduce token limits for simple queries
3. Use smaller models for general tasks
4. Implement request batching in scripts
5. Cache frequently asked questions

### Better Results

1. Provide context and be specific
2. Use follow-up questions to refine
3. Try different models for different tasks
4. Adjust temperature for consistency/creativity
5. Reference previous messages in conversation

## 🐛 Reporting Issues

Found a bug? Have a feature request?

1. Check [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Search existing [GitHub Issues](https://github.com/tbmobb813/Linux-AI-Assistant/issues)
3. Collect debug info: See [Troubleshooting → Getting Help](TROUBLESHOOTING.md#getting-help)
4. Create detailed bug report with:
   - Application version
   - OS and version
   - Steps to reproduce
   - Expected vs actual behavior
   - System specifications

## 🤝 Contributing

Want to help improve the Linux AI Assistant?

1. Read [Developer Guide](DEVELOPER_GUIDE.md)
2. Fork the repository
3. Create feature branch
4. Make changes and test
5. Submit pull request

See [Contributing Guide](https://github.com/tbmobb813/Linux-AI-Assistant/blob/main/CONTRIBUTING.md) for details.

## 📞 Support & Community

- **Documentation**: This file and linked guides
- **Issues**: [GitHub Issues](https://github.com/tbmobb813/Linux-AI-Assistant/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tbmobb813/Linux-AI-Assistant/discussions)
- **Email Support**: See repository for contact info

## 📝 Documentation Structure

```text
linux-ai-assistant/
├── README.md                      # Project overview
├── USER_GUIDE.md                  # User documentation
├── CLI_GUIDE.md                   # Command-line usage
├── TROUBLESHOOTING.md             # Problem solving
├── DEVELOPER_GUIDE.md             # Development reference
├── DOCUMENTATION_INDEX.md         # This file
├── (Phase summaries archived in ../../docs/archive/phase-summaries/)
└── ...
```

## 🎓 Learning Resources

### Getting Started

- [User Guide](USER_GUIDE.md) - Complete feature walkthrough
- [Quick Start Video](https://www.youtube.com/watch?v=...) - Visual guide (future)

### Advanced Usage

- [CLI Guide](CLI_GUIDE.md) - Script integration and automation
- [Developer Guide](DEVELOPER_GUIDE.md) - API and extension development

### Troubleshooting

- [Troubleshooting Guide](TROUBLESHOOTING.md) - Problem-solving reference
- [FAQ](USER_GUIDE.md#faq) - Common questions

## 📜 Version History

**Version 1.1** - November 2025

- 🚀 **Linux Quick Wins Complete**: 6 major enhancements implemented
  - Slash Commands System (7 commands)
  - Document Search & Full-text Indexing
  - Terminal Capture & AI Analysis
  - Profile Management System
  - Enhanced Export (4 formats)
  - Expanded Global Shortcuts (12 shortcuts)
- 📚 **Documentation Updates**: Comprehensive guide updates
- 🔧 **Developer Experience**: Enhanced CLI tools and API documentation

**Version 1.0** - October 2025

- Phase 5: Local AI & Privacy - Complete
- Phase 6.1: Performance Optimization - Complete
- Phase 6.2: Error Handling - Complete
- Phase 6.3: User Documentation - Complete

See [Main README](README.md) for full version history and roadmap.

## 📄 License

Linux AI Assistant is licensed under [LICENSE FILE]. See repository for details.

---

**Last Updated**: November 2025  
**Documentation Version**: 1.1

For the latest documentation, visit:
<https://github.com/tbmobb813/Linux-AI-Assistant>
