#!/bin/bash

# Simple script to run Flutter app on both iPhone and Simulator
# Uses Flutter's built-in multi-device support

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🚀 Starting Flutter app on all iOS devices...${NC}"
echo ""

# Check devices
echo -e "${YELLOW}📱 Checking available devices...${NC}"
DEVICES=$(flutter devices | grep -E "ios|iPhone" | wc -l | tr -d ' ')

if [ "$DEVICES" -lt 2 ]; then
    echo -e "${YELLOW}⚠️  Not enough iOS devices found. Make sure:${NC}"
    echo "  • iPhone is connected via USB"
    echo "  • Simulator is running (or will be started automatically)"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Starting on all iOS devices...${NC}"
echo -e "${YELLOW}💡 Hot reload (r) and hot restart (R) will apply to all devices${NC}"
echo ""

# Run on all iOS devices
flutter run -d ios

