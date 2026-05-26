#!/bin/bash

# Test script for project detection feature
# Tests detection across different project types

echo "🧪 Testing Project Detection Feature"
echo "===================================="
echo ""

# Test 1: Current directory (should detect Rust)
echo "Test 1: Current directory (Rust project)"
echo "Expected: Rust project with name 'linux-ai-assistant'"
echo ""

# We'll manually test this in the UI since it requires the Tauri app running

# Test 2: Create temporary Node.js project
echo "Test 2: Creating temporary Node.js project..."
TEMP_NODE=$(mktemp -d)
cat > "$TEMP_NODE/package.json" << 'EOF'
{
  "name": "test-nodejs-app",
  "version": "1.2.3",
  "description": "Test Node.js application for detection"
}
EOF
echo "Created: $TEMP_NODE"
echo "Expected: Node.js project with name 'test-nodejs-app' v1.2.3"
echo ""

# Test 3: Create temporary Python project
echo "Test 3: Creating temporary Python project..."
TEMP_PYTHON=$(mktemp -d)
cat > "$TEMP_PYTHON/pyproject.toml" << 'EOF'
[project]
name = "test-python-app"
version = "2.0.0"
description = "Test Python application for detection"
EOF
echo "Created: $TEMP_PYTHON"
echo "Expected: Python project with name 'test-python-app' v2.0.0"
echo ""

# Test 4: Create temporary Go project
echo "Test 4: Creating temporary Go project..."
TEMP_GO=$(mktemp -d)
cat > "$TEMP_GO/go.mod" << 'EOF'
module github.com/test/go-app

go 1.21
EOF
echo "Created: $TEMP_GO"
echo "Expected: Go project with module 'github.com/test/go-app'"
echo ""

# Test 5: Directory with no project markers
echo "Test 5: Creating empty directory..."
TEMP_EMPTY=$(mktemp -d)
echo "Created: $TEMP_EMPTY"
echo "Expected: Unknown project type"
echo ""

echo "📝 Manual Testing Instructions"
echo "=============================="
echo ""
echo "1. Start the Tauri app in dev mode:"
echo "   cd linux-ai-assistant && pnpm run tauri dev"
echo ""
echo "2. Test each directory by setting it as the project root"
echo "   or by opening a terminal in each directory"
echo ""
echo "3. Verify the GitContextWidget displays:"
echo "   - Correct project icon (📦 for Node, 🦀 for Rust, etc.)"
echo "   - Project name and version in header"
echo "   - Full details when expanded"
echo ""
echo "Test Directories:"
echo "  Rust:    $(pwd)"
echo "  Node.js: $TEMP_NODE"
echo "  Python:  $TEMP_PYTHON"
echo "  Go:      $TEMP_GO"
echo "  Unknown: $TEMP_EMPTY"
echo ""
echo "4. Click 'Include Context' and verify markdown output includes"
echo "   project information section at the top"
echo ""
echo "5. Cleanup test directories when done:"
echo "   rm -rf $TEMP_NODE $TEMP_PYTHON $TEMP_GO $TEMP_EMPTY"
echo ""
echo "✅ Automated test stub complete!"
echo "   Full E2E tests require Playwright with Tauri app running."
