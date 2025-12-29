#!/bin/bash

# Script to run Flutter app on iPhone and Simulator in separate terminal windows
# This gives you independent control of each device

set -e

# Device IDs
IPHONE_ID="00008110-000C71A6112A401E"
SIMULATOR_ID="2C06508F-3A4D-4607-9D50-CB9226EA4835"

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 Opening separate terminal windows for each device..."
echo ""

# Open iPhone in new Terminal window
osascript <<EOF
tell application "Terminal"
    activate
    set iPhoneWindow to do script "cd '$SCRIPT_DIR' && echo '📱 Running on iPhone (Tredoux'\''s iPhone)' && flutter run -d $IPHONE_ID"
    set custom title of iPhoneWindow to "Flutter - iPhone"
end tell
EOF

# Wait a moment
sleep 2

# Open Simulator in new Terminal window
osascript <<EOF
tell application "Terminal"
    activate
    set SimulatorWindow to do script "cd '$SCRIPT_DIR' && echo '📱 Running on Simulator (iPhone 16 Plus)' && flutter run -d $SIMULATOR_ID"
    set custom title of SimulatorWindow to "Flutter - Simulator"
end tell
EOF

echo "✅ Two terminal windows opened!"
echo ""
echo "💡 Each device runs independently:"
echo "  • Hot reload (r) works in each window separately"
echo "  • You can test different scenarios on each device"
echo "  • Close windows individually when done"

