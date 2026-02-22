#!/bin/bash

# Guardian Connect - Production Build Script
# This script builds all applications for production deployment

set -e  # Exit on error

echo "🚀 Starting Guardian Connect Production Build..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "web-user" ] || [ ! -d "admin" ]; then
    echo "❌ Error: Please run this script from the guardian-connect root directory"
    exit 1
fi

# Build Backend
print_section "📦 Building Backend API"
cd backend
if [ ! -f "package.json" ]; then
    echo "❌ Error: backend/package.json not found"
    exit 1
fi

echo "Installing dependencies..."
npm install --silent

echo "Building TypeScript..."
npm run build

if [ -d "dist" ]; then
    echo -e "${GREEN}✅ Backend build successful${NC}"
    echo "   Output: backend/dist/"
else
    echo "❌ Error: Backend build failed - dist/ directory not found"
    exit 1
fi
cd ..

# Build Web User Interface
print_section "🌐 Building Web User Interface"
cd web-user
if [ ! -f "package.json" ]; then
    echo "❌ Error: web-user/package.json not found"
    exit 1
fi

echo "Installing dependencies..."
npm install --silent

echo "Building React application..."
npm run build

if [ -d "dist" ]; then
    echo -e "${GREEN}✅ Web User build successful${NC}"
    echo "   Output: web-user/dist/"
else
    echo "❌ Error: Web User build failed - dist/ directory not found"
    exit 1
fi
cd ..

# Build Admin Panel
print_section "👨‍💼 Building Admin Panel"
cd admin
if [ ! -f "package.json" ]; then
    echo "❌ Error: admin/package.json not found"
    exit 1
fi

echo "Installing dependencies..."
npm install --silent

echo "Building React application..."
npm run build

if [ -d "dist" ]; then
    echo -e "${GREEN}✅ Admin Panel build successful${NC}"
    echo "   Output: admin/dist/"
else
    echo "❌ Error: Admin Panel build failed - dist/ directory not found"
    exit 1
fi
cd ..

# Summary
print_section "📊 Build Summary"
echo -e "${GREEN}✅ All builds completed successfully!${NC}"
echo ""
echo "Production builds are ready in:"
echo "  • Backend:    backend/dist/"
echo "  • Web User:   web-user/dist/"
echo "  • Admin:      admin/dist/"
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "  1. Review PRODUCTION_ENV.md for environment variables"
echo "  2. Configure production environment variables"
echo "  3. Deploy according to DEPLOYMENT_GUIDE.md"
echo ""
echo -e "${GREEN}🎉 Build process complete!${NC}"





