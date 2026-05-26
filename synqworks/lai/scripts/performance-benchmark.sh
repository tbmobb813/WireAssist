#!/bin/bash

# Performance Benchmark Script for Linux AI Assistant
# Measures key performance metrics against Phase 6 targets

set -e

echo "🚀 Linux AI Assistant - Performance Benchmark"
echo "=============================================="
echo ""

# Configuration
BINARY_PATH="./src-tauri/target/release/app"
RESULTS_FILE="performance-results.json"
MEASUREMENTS_COUNT=5

# Performance Targets
TARGET_STARTUP_TIME=2.0      # seconds
TARGET_MEMORY_IDLE=200       # MB
TARGET_BINARY_SIZE=15        # MB
TARGET_FRONTEND_SIZE=2       # MB (gzipped)

echo "📊 Performance Targets:"
echo "  - Startup time: < ${TARGET_STARTUP_TIME}s"
echo "  - Memory usage: < ${TARGET_MEMORY_IDLE}MB (idle)"
echo "  - Binary size: < ${TARGET_BINARY_SIZE}MB"
echo "  - Frontend bundle: < ${TARGET_FRONTEND_SIZE}MB (gzipped)"
echo ""

# Function to measure startup time
measure_startup_time() {
    echo "⏱️  Measuring application startup time..."

    local total_time=0
    local measurements=()

    for i in $(seq 1 $MEASUREMENTS_COUNT); do
        echo "  Run $i/$MEASUREMENTS_COUNT..."

        # Start time measurement
        local start_time=$(date +%s.%N)

        # Start the application in background
        $BINARY_PATH &
        local app_pid=$!

        # Wait for app to be ready (check if window appears)
        local window_ready=false
        local timeout=10
        local elapsed=0

        while [ $elapsed -lt $timeout ] && [ $window_ready = false ]; do
            if xdotool search --name "Linux AI Assistant" >/dev/null 2>&1; then
                window_ready=true
                local end_time=$(date +%s.%N)
                local startup_time=$(echo "$end_time - $start_time" | bc)
                measurements+=($startup_time)
                total_time=$(echo "$total_time + $startup_time" | bc)
                echo "    Startup time: ${startup_time}s"
            else
                sleep 0.1
                elapsed=$(echo "$elapsed + 0.1" | bc)
            fi
        done

        # Kill the application
        kill $app_pid >/dev/null 2>&1 || true
        sleep 1

        if [ $window_ready = false ]; then
            echo "    ⚠️  Warning: Startup measurement timed out"
        fi
    done

    if [ ${#measurements[@]} -gt 0 ]; then
        local avg_startup=$(echo "scale=3; $total_time / ${#measurements[@]}" | bc)
        echo "  Average startup time: ${avg_startup}s"

        if [ $(echo "$avg_startup < $TARGET_STARTUP_TIME" | bc) -eq 1 ]; then
            echo "  ✅ Startup time target met!"
        else
            echo "  ❌ Startup time target missed (${avg_startup}s > ${TARGET_STARTUP_TIME}s)"
        fi
    else
        echo "  ❌ No successful startup measurements"
    fi
}

# Function to measure memory usage
measure_memory_usage() {
    echo ""
    echo "💾 Measuring memory usage..."

    # Start the application
    $BINARY_PATH &
    local app_pid=$!

    # Wait for app to stabilize
    sleep 3

    # Measure memory usage (RSS in KB)
    if kill -0 $app_pid 2>/dev/null; then
        local memory_kb=$(ps -o rss= -p $app_pid)
        local memory_mb=$(echo "scale=1; $memory_kb / 1024" | bc)

        echo "  Memory usage (RSS): ${memory_mb}MB"

        if [ $(echo "$memory_mb < $TARGET_MEMORY_IDLE" | bc) -eq 1 ]; then
            echo "  ✅ Memory usage target met!"
        else
            echo "  ❌ Memory usage target missed (${memory_mb}MB > ${TARGET_MEMORY_IDLE}MB)"
        fi
    else
        echo "  ❌ Application not running for memory measurement"
    fi

    # Clean up
    kill $app_pid >/dev/null 2>&1 || true
}

# Function to measure binary sizes
measure_binary_sizes() {
    echo ""
    echo "📦 Measuring binary and bundle sizes..."

    # Main binary size
    if [ -f "$BINARY_PATH" ]; then
        local binary_size_mb=$(du -m "$BINARY_PATH" | cut -f1)
        echo "  Main binary: ${binary_size_mb}MB"

        if [ $binary_size_mb -lt $TARGET_BINARY_SIZE ]; then
            echo "  ✅ Binary size target met!"
        else
            echo "  ❌ Binary size target missed (${binary_size_mb}MB > ${TARGET_BINARY_SIZE}MB)"
        fi
    else
        echo "  ❌ Binary not found: $BINARY_PATH"
    fi

    # Frontend bundle size
    if [ -d "dist" ]; then
        local frontend_size_mb=$(du -sm dist | cut -f1)
        echo "  Frontend bundle: ${frontend_size_mb}MB"

        # Check main JS bundle gzipped size
        local main_js=$(find dist/assets -name "index-*.js" -type f | head -1)
        if [ -f "$main_js" ]; then
            local gzipped_size_kb=$(gzip -c "$main_js" | wc -c | awk '{print int($1/1024)}')
            echo "  Main JS bundle (gzipped): ${gzipped_size_kb}KB"
        fi

        if [ $frontend_size_mb -lt $TARGET_FRONTEND_SIZE ]; then
            echo "  ✅ Frontend size target met!"
        else
            echo "  ❌ Frontend size target missed (${frontend_size_mb}MB > ${TARGET_FRONTEND_SIZE}MB)"
        fi
    else
        echo "  ❌ Frontend dist folder not found"
    fi

    # Package sizes
    echo ""
    echo "  Distribution packages:"
    find src-tauri/target/release/bundle -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" 2>/dev/null | while read file; do
        local size_mb=$(du -m "$file" | cut -f1)
        echo "    $(basename "$file"): ${size_mb}MB"
    done
}

# Function to run database performance tests
measure_database_performance() {
    echo ""
    echo "🗄️  Database performance test..."

    # This would require the app to be running with test data
    echo "  Note: Database performance tests require running application"
    echo "  Target: Query time < 50ms"
    echo "  🔄 To be implemented with database benchmarking"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    command -v bc >/dev/null 2>&1 || missing_deps+=("bc")
    command -v xdotool >/dev/null 2>&1 || missing_deps+=("xdotool")

    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo "❌ Missing dependencies: ${missing_deps[*]}"
        echo "   Install with: sudo apt install ${missing_deps[*]}"
        exit 1
    fi
}

# Main execution
main() {
    check_dependencies

    echo "🔧 Building application..."
    npm run build >/dev/null

    echo "✅ Starting performance benchmark..."
    echo ""

    measure_startup_time
    measure_memory_usage
    measure_binary_sizes
    measure_database_performance

    echo ""
    echo "📈 Performance Summary"
    echo "====================="
    echo "Review the results above to identify optimization opportunities."
    echo ""
    echo "🎯 Next Steps:"
    echo "  1. Optimize bundle size (target: reduce main JS bundle)"
    echo "  2. Implement lazy loading for UI components"
    echo "  3. Optimize database queries and add indexing"
    echo "  4. Profile memory usage and fix potential leaks"
    echo ""
}

# Run the benchmark
main "$@"
