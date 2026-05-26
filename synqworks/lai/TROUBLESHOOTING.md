# Linux AI Assistant - Troubleshooting Guide

Comprehensive troubleshooting guide for common issues and solutions.

## Quick Diagnosis

**First Steps:**

1. Check application version: `Settings → About`
2. Check system resources: `free -h`, `df -h`
3. Check logs: `~/.config/linux-ai-assistant/logs/`
4. Try restarting the application
5. Clear cache: `Settings → Data → Clear Cache`

## Connection & Network Issues

### Application Won't Connect to AI Provider

**Symptoms:**

- Error: "Cannot connect to service"
- Empty response window
- Timeout on every request

**Diagnosis:**

```bash
# Test internet connectivity
ping -c 1 google.com

# Test specific provider endpoint
curl -I https://api.openai.com/v1/models

# Check if local service is running
curl http://localhost:11434/api/tags
```

**Solutions:**

1. **Check Internet Connection**

   ```bash
   # Verify connectivity
   nmcli device wifi list
   nmcli connection show

   # If not connected, reconnect to network
   ```

2. **Verify API Credentials**
   - OpenAI: Visit [platform.openai.com](https://platform.openai.com/api-keys)
   - Anthropic: Visit [claude.ai](https://claude.ai)
   - Gemini: Visit [ai.google.dev](https://ai.google.dev)
   - Check API key validity and remaining credits

3. **Check Firewall Settings**

   ```bash
   # If using UFW
   sudo ufw allow out 443  # HTTPS
   sudo ufw allow out 80   # HTTP

   # If using firewalld
   sudo firewall-cmd --permanent --add-service=https
   sudo firewall-cmd --reload
   ```

4. **Check DNS Resolution**

   ```bash
   # Test DNS
   nslookup api.openai.com
   dig api.openai.com

   # Try alternate DNS if needed
   echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf.d/99-custom-dns
   ```

5. **Test with Curl**
   ```bash
   # Test OpenAI endpoint
   curl -X GET https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### Ollama Not Responding

**Symptoms:**

- "Connection refused" when using Ollama
- "Cannot connect to localhost:11434"
- Ollama selected but no responses

**Solutions:**

1. **Check Ollama Service Status**

   ```bash
   # If installed as system service
   systemctl status ollama
   systemctl start ollama
   systemctl enable ollama

   # If running manually
   ollama serve
   ```

2. **Verify Ollama Configuration**

   ```bash
   # Check if running on expected port
   lsof -i :11434

   # Verify endpoint in Settings
   # Default: http://localhost:11434
   ```

3. **Test Connection**

   ```bash
   # Direct test
   curl http://localhost:11434/api/tags

   # Should return JSON with available models
   ```

4. **Check Model Download Status**

   ```bash
   # If model appears unavailable
   ollama list

   # Pull model manually if needed
   ollama pull mistral
   ```

5. **Restart Ollama**
   ```bash
   # Kill process and restart
   killall ollama
   sleep 2
   ollama serve
   ```

### Network Timeout Errors

**Symptoms:**

- "Request timeout" after 30 seconds
- Responses stop mid-sentence
- Intermittent connectivity

**Solutions:**

1. **Increase Timeout**

   ```bash
   # In CLI
   export LAI_TIMEOUT=60

   # Or in Settings if available
   ```

2. **Check Network Quality**

   ```bash
   # Test latency and packet loss
   ping -c 10 api.openai.com

   # Check bandwidth availability
   speedtest-cli
   ```

3. **Reduce Response Size**

   ```bash
   # Settings → AI Provider
   # Reduce max tokens to 500-1000
   # Reduces response size and network overhead
   ```

4. **Use Local Models**
   - Switch to Ollama if available
   - Local models have lower latency

## Authentication & API Issues

### Invalid API Key Error

**Symptoms:**

- "Invalid API key" or "Unauthorized"
- 401 Unauthorized responses
- Authentication failed repeatedly

**Solutions:**

1. **Verify Key Format**

   ```bash
   # OpenAI keys start with 'sk-'
   # Make sure no extra spaces or line breaks

   echo "sk-your-key-here" | wc -c
   # Should be expected length + 1 (newline)
   ```

2. **Check Key Validity**
   - Visit provider's dashboard
   - Verify key hasn't been revoked
   - Check key expiration date (if applicable)
   - Verify key has required permissions

3. **Re-enter Credentials**

   ```bash
   # Clear cache and re-enter
   Settings → AI Provider → [Provider Name]
   Delete existing key
   Enter new key
   Test connection
   ```

4. **Check API Account Status**
   - Verify account is active
   - Check billing/payment status
   - Ensure account hasn't hit usage limits
   - Verify quota hasn't been exceeded

### Rate Limiting / Quota Exceeded

**Symptoms:**

- Error 429: "Rate limit exceeded"
- Requests fail after many messages
- Error: "Quota exceeded"

**Solutions:**

1. **Reduce Request Frequency**

   ```bash
   # Wait between requests
   # Most providers: 60-90 requests per minute
   ```

2. **Use Smaller Requests**
   - Reduce max tokens
   - Use simpler queries
   - Batch similar requests

3. **Upgrade Account**
   - Some providers offer higher limits with paid tiers
   - Check provider's pricing page

4. **Switch to Local Models**
   - Use Ollama for unlimited local requests
   - No rate limits on local inference

5. **Implement Request Queuing**
   ```bash
   # Space out requests
   sleep 2  # Wait 2 seconds between requests
   ```

## Performance Issues

### Application is Slow or Unresponsive

**Symptoms:**

- UI lag or freezing
- Slow message sending
- Response display is sluggish
- Application takes long to start

**Diagnosis:**

```bash
# Check system resources
free -h              # Memory usage
df -h                # Disk space
top -p $(pgrep -f linux-ai-assistant)  # Process resource usage

# Check application logs
tail -f ~/.config/linux-ai-assistant/logs/app.log
```

**Solutions:**

1. **Free Up System Memory**

   ```bash
   # Check memory usage
   free -h

   # Close unnecessary applications
   # If critical: increase swap (risky)
   sudo dd if=/dev/zero of=/swapfile bs=1G count=4
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

2. **Clear Application Cache**

   ```bash
   # Via GUI: Settings → Data → Clear Cache

   # Or manually
   rm -rf ~/.config/linux-ai-assistant/cache
   ```

3. **Disable Animations**

   ```bash
   # Settings → Appearance → Disable Animations
   # Reduces UI rendering overhead
   ```

4. **Use Lightweight Models**

   ```bash
   # Switch to faster models
   # 7B parameter models faster than 13B or 70B

   # Local: Use quantized models
   ollama pull mistral:7b-q4
   ```

5. **Reduce UI Complexity**
   - Limit conversation length (archive old messages)
   - Use local models instead of cloud (faster)
   - Restart application periodically

6. **Optimize Disk Space**

   ```bash
   # Check disk usage
   du -sh ~/.config/linux-ai-assistant/

   # If database is large, archive conversations
   # Or clear old conversations
   ```

### Large Conversation Lag

**Symptoms:**

- Application slows down with large conversations
- Scrolling becomes sluggish
- Response delays increase

**Solutions:**

1. **Archive Old Messages**
   - Keep active conversations shorter
   - Archive completed discussions

2. **Clear Message History**
   - Settings → Data → Clear Conversation
   - Start fresh conversation

3. **Export & Reset**
   - Export conversation to JSON/Markdown
   - Delete original conversation
   - Keeps your data but reduces application load

4. **Check Database Health**
   ```bash
   # On Linux systems
   sqlite3 ~/.config/linux-ai-assistant/conversations.db "PRAGMA integrity_check;"
   ```

## Model & Provider Issues

### Model Not Available

**Symptoms:**

- Selected model doesn't appear in list
- "Model not found" error
- Model disappeared after restart

**Solutions:**

1. **For Local Models (Ollama)**

   ```bash
   # List available models
   ollama list

   # If model missing, pull it
   ollama pull mistral

   # Check model cache
   ls ~/.ollama/models/manifests/registry.ollama.ai/library/
   ```

2. **For Cloud Models**
   - Check provider's supported models list
   - Verify account has access to model
   - Some models may be restricted by region or tier

3. **Refresh Model List**

   ```bash
   # CLI
   lai models list --refresh

   # Or restart application
   ```

### Model Download Stuck

**Symptoms:**

- Download progress stuck at 0% or doesn't complete
- "Downloading..." state persists indefinitely

**Solutions:**

1. **Check Download Progress**

   ```bash
   # For Ollama
   ls -lah ~/.ollama/models/blobs/
   # Larger files should show progress
   ```

2. **Cancel and Retry**
   - Press Escape or click Cancel
   - Wait 30 seconds
   - Try downloading again

3. **Check Disk Space**

   ```bash
   # Models can be 1-70+ GB depending on size
   df -h

   # Free up space if needed
   ```

4. **Verify Internet Connection**

   ```bash
   # Download usually resumes, but check connectivity
   ping download.ollama.ai
   ```

5. **Manual Download (for Ollama)**
   ```bash
   # Pull with verbose output
   OLLAMA_DEBUG=1 ollama pull mistral
   ```

### Poor Response Quality

**Symptoms:**

- Responses are inaccurate or irrelevant
- Model seems confused
- Repetitive or nonsensical output

**Solutions:**

1. **Provide Better Context**
   - Include relevant background information
   - Be specific and clear in questions
   - Use examples

2. **Adjust Model Temperature**

   ```bash
   # Settings → AI Provider → Temperature
   # Lower (0.3): More consistent, deterministic
   # Higher (0.9): More creative, varied
   ```

3. **Try Different Model**
   - 7B models: Fast, good for general tasks
   - 13B models: Better quality
   - 70B models: Excellent quality but slow

4. **Clear Conversation**
   - Start fresh to avoid context contamination
   - Long conversations can confuse models

5. **Check Model Size**
   ```bash
   # Quantized models (Q4, Q5) may be lower quality
   # Full precision models (fp16, fp32) offer better quality
   ```

## Data & Storage Issues

### Cannot Save Conversations

**Symptoms:**

- "Error saving conversation"
- New messages don't persist
- Data lost after restart

**Diagnosis:**

```bash
# Check database
ls -la ~/.config/linux-ai-assistant/

# Check permissions
ls -la ~/.config/linux-ai-assistant/conversations.db

# Check disk space
df -h

# Check logs
tail -20 ~/.config/linux-ai-assistant/logs/error.log
```

**Solutions:**

1. **Check Disk Space**

   ```bash
   # Need at least 1GB free for safety
   df -h

   # If full, delete large files
   ```

2. **Fix Database Permissions**

   ```bash
   # Ensure user owns database
   sudo chown $USER:$USER ~/.config/linux-ai-assistant/conversations.db
   chmod 600 ~/.config/linux-ai-assistant/conversations.db
   ```

3. **Repair Database**

   ```bash
   # Backup first
   cp ~/.config/linux-ai-assistant/conversations.db \
      ~/.config/linux-ai-assistant/conversations.db.backup

   # Check database integrity
   sqlite3 ~/.config/linux-ai-assistant/conversations.db "PRAGMA integrity_check;"

   # If broken, restore backup or clear
   ```

4. **Rebuild Database**

   ```bash
   # Stop application
   # Backup data
   mv ~/.config/linux-ai-assistant/conversations.db \
      ~/.config/linux-ai-assistant/conversations.db.old

   # Restart application (creates new database)
   # Manually reimport conversations if needed
   ```

### Cannot Export/Import

**Symptoms:**

- Export hangs or fails
- Import fails silently
- File format errors

**Solutions:**

1. **Check File Format**

   ```bash
   # Verify JSON is valid
   jq empty ~/conversation.json

   # For Markdown, check file structure
   head -20 ~/conversation.md
   ```

2. **Export Small Batches**
   - If all-export fails, export individual conversations
   - Easier to identify problematic conversations

3. **Check File Permissions**

   ```bash
   # Ensure write access to export destination
   touch ~/test.txt && rm ~/test.txt
   ```

4. **Free Up Disk Space**

   ```bash
   # Ensure 100MB+ free space for export
   df -h
   ```

5. **Manual Import**

   ```bash
   # Via CLI
   lai import ~/conversation.json

   # With debugging
   LAI_DEBUG=1 lai import ~/conversation.json
   ```

## UI & Display Issues

### Application Won't Start

**Symptoms:**

- Nothing happens when clicking app icon
- No window appears
- Silent failure

**Solutions:**

1. **Check Logs**

   ```bash
   tail -50 ~/.config/linux-ai-assistant/logs/app.log
   ```

2. **Start from Terminal**

   ```bash
   # Find application path
   which linux-ai-assistant
   /opt/linux-ai-assistant/linux-ai-assistant
   ```

3. **Verify Dependencies**

   ```bash
   # Check for missing libraries
   ldd /opt/linux-ai-assistant/linux-ai-assistant | grep "not found"
   ```

4. **Reset Configuration**

   ```bash
   # Backup config
   mv ~/.config/linux-ai-assistant \
      ~/.config/linux-ai-assistant.backup

   # Start application (creates new config)
   ```

### Display Issues (Theme, Fonts, etc.)

**Symptoms:**

- Wrong colors or theme
- Text too small/large
- Interface layout broken

**Solutions:**

1. **Reset Theme**

   ```bash
   # Settings → Appearance → Theme
   # Try different theme options
   ```

2. **Adjust Font Size**

   ```bash
   # Settings → Appearance → Font Size
   # Use slider or manual entry
   ```

3. **Check Display Settings**

   ```bash
   # If using HiDPI display
   export QT_SCALE_FACTOR=2
   ```

4. **Verify GPU Acceleration**
   ```bash
   # If display is glitchy
   export QT_XCB_GL_INTEGRATION=none
   ```

## New Features Troubleshooting

### Slash Commands Issues

**Problem**: Slash commands not working or showing autocomplete

**Solutions:**

1. **Check Chat Input Focus**

   ```bash
   # Ensure chat input is focused when typing /
   # Click in chat input area before typing
   ```

2. **Verify Command Syntax**

   ```bash
   # Correct syntax examples
   /clear
   /export json
   /docs search query
   /run ls -la
   /profile myprofile
   ```

3. **Clear Cache if Commands Don't Show**
   ```bash
   # Clear application cache
   rm -rf ~/.config/linux-ai-assistant/cache/
   ```

### Document Search Problems

**Problem**: Document search returns no results or is slow

**Solutions:**

1. **Check Project Indexing**

   ```bash
   # Verify project path is set correctly
   # Go to Settings → Project Integration
   # Ensure "Watch for Changes" is enabled
   ```

2. **Re-index Project**

   ```bash
   # Force re-indexing via CLI
   lai index-project /path/to/project

   # Or use slash command
   /docs --reindex
   ```

3. **Check File Permissions**

   ```bash
   # Ensure readable files
   find /path/to/project -type f ! -readable

   # Fix permissions if needed
   chmod -R +r /path/to/project
   ```

4. **Verify Ignore Patterns**
   ```bash
   # Check .gitignore and custom patterns
   # Go to Settings → Document Search
   # Review exclude patterns
   ```

### Profile System Issues

**Problem**: Profiles not switching or data loss

**Solutions:**

1. **Check Profile Database**

   ```bash
   # Verify profile database
   sqlite3 ~/.config/linux-ai-assistant/profiles.db ".tables"

   # List existing profiles
   sqlite3 ~/.config/linux-ai-assistant/profiles.db "SELECT * FROM profiles;"
   ```

2. **Reset Profile System**

   ```bash
   # Backup first
   cp ~/.config/linux-ai-assistant/profiles.db ~/.config/linux-ai-assistant/profiles.db.backup

   # Reset profiles (will recreate default)
   rm ~/.config/linux-ai-assistant/profiles.db
   ```

3. **Profile Switching Shortcut Not Working**
   ```bash
   # Check global shortcuts in Settings
   # Verify Ctrl+P is not conflicting
   # Try using /profile <name> command instead
   ```

### Terminal Capture Issues

**Problem**: CLI capture command fails or dangerous commands allowed

**Solutions:**

1. **Check CLI Tool Installation**

   ```bash
   # Verify CLI is built and accessible
   cd linux-ai-assistant/cli
   cargo build --release

   # Add to PATH or use full path
   export PATH="$PATH:/path/to/linux-ai-assistant/cli/target/release"
   ```

2. **IPC Connection Problems**

   ```bash
   # Check if main app is running
   ps aux | grep linux-ai-assistant

   # Verify IPC port
   netstat -tlnp | grep 39871

   # Test connection
   lai notify "Test connection"
   ```

3. **Command Safety Validation**

   ```bash
   # If safe commands are blocked
   lai capture "ls" --dry-run

   # Check safety settings
   # Go to Settings → Terminal Integration
   ```

### Export Format Issues

**Problem**: Export fails or formatting is incorrect

**Solutions:**

1. **Check File Permissions**

   ```bash
   # Ensure write access to export directory
   ls -la ~/Documents/

   # Create export directory if needed
   mkdir -p ~/Documents/ai-exports
   ```

2. **PDF Export Dependencies**

   ```bash
   # Verify system fonts for PDF generation
   fc-list | grep -i "liberation\|dejavu"

   # Install missing fonts if needed
   sudo apt install fonts-liberation fonts-dejavu
   ```

3. **Large Conversation Export**

   ```bash
   # For very large conversations, use JSON format
   /export json

   # Or export in chunks using conversation filters
   ```

### Global Shortcuts Conflicts

**Problem**: Shortcuts not working or conflicting with system shortcuts

**Solutions:**

1. **Check Shortcut Conflicts**

   ```bash
   # Use Settings → Global Shortcuts
   # Look for conflicts marked in red
   # Change conflicting shortcuts
   ```

2. **System-wide Shortcut Issues**

   ```bash
   # Check window manager shortcuts
   gsettings list-recursively | grep -i shortcut

   # For KDE users
   kreadconfig5 --group Shortcuts
   ```

3. **Permission Issues**
   ```bash
   # Some desktop environments require additional permissions
   # Try running app with:
   env XDG_CURRENT_DESKTOP=GNOME linux-ai-assistant
   ```

## Getting Help

### Collecting Debug Information

```bash
# Generate debug report
lai health --verbose > debug_report.txt

# Include key information
echo "=== System Info ===" >> debug_report.txt
uname -a >> debug_report.txt
free -h >> debug_report.txt
df -h >> debug_report.txt

# Include application logs
echo "=== Application Logs ===" >> debug_report.txt
tail -100 ~/.config/linux-ai-assistant/logs/*.log >> debug_report.txt
```

### Submitting Bug Reports

Include:

1. Application version
2. Operating system and version
3. Exact steps to reproduce
4. Error messages
5. Debug log output
6. System specifications (RAM, disk space, etc.)

### Getting Support

- **GitHub Issues**: [Report bugs on GitHub](https://github.com/tbmobb813/Linux-AI-Assistant)
- **Documentation**: See USER_GUIDE.md and CLI_GUIDE.md
- **Community**: Check discussions for solutions

---

**Version**: 1.0  
**Last Updated**: October 2025
