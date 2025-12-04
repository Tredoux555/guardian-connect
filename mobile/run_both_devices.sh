#!/bin/bash

# Script to run Flutter app on both iPhone and Simulator simultaneously
# Usage: ./run_both_devices.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Device IDs
IPHONE_ID="00008110-000C71A6112A401E"
SIMULATOR_ID="2C06508F-3A4D-4607-9D50-CB9226EA4835"

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🚀 Starting Flutter app on both devices...${NC}"
echo ""

# Check if devices are available
echo -e "${YELLOW}📱 Checking available devices...${NC}"
if ! flutter devices | grep -q "$IPHONE_ID"; then
    echo -e "${YELLOW}⚠️  iPhone not found. Make sure it's connected via USB.${NC}"
    exit 1
fi

if ! flutter devices | grep -q "$SIMULATOR_ID"; then
    echo -e "${YELLOW}⚠️  Simulator not found. Starting simulator...${NC}"
    open -a Simulator
    sleep 5
fi

echo ""
echo -e "${GREEN}✅ Both devices detected!${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping Flutter processes...${NC}"
    pkill -f "flutter run.*$IPHONE_ID" || true
    pkill -f "flutter run.*$SIMULATOR_ID" || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

trap cleanup EXIT INT TERM

# Run on iPhone in background
echo -e "${BLUE}📱 Starting on iPhone (Tredoux's iPhone)...${NC}"
flutter run -d "$IPHONE_ID" > /tmp/flutter_iphone.log 2>&1 &
IPHONE_PID=$!

# Wait a bit before starting simulator
sleep 3

# Run on Simulator in background
echo -e "${BLUE}📱 Starting on Simulator (iPhone 16 Plus)...${NC}"
flutter run -d "$SIMULATOR_ID" > /tmp/flutter_simulator.log 2>&1 &
SIMULATOR_PID=$!

echo ""
echo -e "${GREEN}✅ Both apps are starting!${NC}"
echo ""
echo -e "${YELLOW}📋 Logs:${NC}"
echo "  iPhone:    tail -f /tmp/flutter_iphone.log"
echo "  Simulator: tail -f /tmp/flutter_simulator.log"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "  • Press 'r' in this terminal to hot reload both apps"
echo "  • Press 'R' to hot restart both apps"
echo "  • Press 'q' to quit"
echo "  • Use 'flutter run -d all' for unified control"
echo ""
echo -e "${BLUE}⏳ Waiting for builds to complete...${NC}"
echo ""

# Wait for both processes
wait $IPHONE_PID
wait $SIMULATOR_PID

