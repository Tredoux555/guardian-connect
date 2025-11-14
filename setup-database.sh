#!/bin/bash

# Guardian Connect - Database Setup Script
# This script helps you set up PostgreSQL for the first time

echo "🔍 Checking if PostgreSQL is installed..."

# Check if psql exists
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed!"
    psql --version
else
    echo "❌ PostgreSQL is not installed."
    echo ""
    echo "Please install PostgreSQL first:"
    echo ""
    echo "Option 1 - Using Homebrew (Recommended):"
    echo "  brew install postgresql@14"
    echo "  brew services start postgresql@14"
    echo ""
    echo "Option 2 - Using Postgres.app (Easier):"
    echo "  Download from: https://postgresapp.com/"
    echo ""
    echo "After installing, run this script again."
    exit 1
fi

echo ""
echo "🔍 Checking if PostgreSQL is running..."

# Try to connect to check if it's running
if psql -l &> /dev/null; then
    echo "✅ PostgreSQL is running!"
else
    echo "❌ PostgreSQL is not running."
    echo ""
    echo "Try starting it:"
    echo "  brew services start postgresql@14"
    echo "  (or open Postgres.app)"
    exit 1
fi

echo ""
echo "🔍 Checking if database 'guardian_connect' exists..."

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw guardian_connect; then
    echo "⚠️  Database 'guardian_connect' already exists!"
    read -p "Do you want to recreate it? (This will DELETE all data!) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Dropping existing database..."
        dropdb guardian_connect 2>/dev/null || true
    else
        echo "✅ Using existing database."
        echo ""
        echo "To recreate tables, run:"
        echo "  psql guardian_connect < backend/src/database/schema.sql"
        exit 0
    fi
fi

echo ""
echo "📦 Creating database 'guardian_connect'..."

# Create database
if createdb guardian_connect 2>/dev/null; then
    echo "✅ Database created successfully!"
else
    echo "❌ Failed to create database."
    echo ""
    echo "Trying to create PostgreSQL user..."
    createuser -s $USER 2>/dev/null || true
    echo "Please try running this script again."
    exit 1
fi

echo ""
echo "📋 Running schema file..."

# Check if schema file exists
if [ ! -f "backend/src/database/schema.sql" ]; then
    echo "❌ Schema file not found at: backend/src/database/schema.sql"
    echo "Make sure you're running this from the project root directory."
    exit 1
fi

# Run schema
if psql guardian_connect < backend/src/database/schema.sql; then
    echo "✅ Schema loaded successfully!"
else
    echo "❌ Failed to load schema."
    exit 1
fi

echo ""
echo "🔍 Verifying tables were created..."

# Count tables
TABLE_COUNT=$(psql guardian_connect -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)

if [ "$TABLE_COUNT" -gt "0" ]; then
    echo "✅ Found $TABLE_COUNT tables in the database!"
    echo ""
    echo "Tables created:"
    psql guardian_connect -c "\dt" | tail -n +4 | head -n -2
else
    echo "❌ No tables found. Something went wrong."
    exit 1
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update backend/.env with your database credentials:"
echo "   DB_HOST=localhost"
echo "   DB_PORT=5432"
echo "   DB_NAME=guardian_connect"
echo "   DB_USER=$USER"
echo "   DB_PASSWORD="
echo ""
echo "2. Start your backend server:"
echo "   cd backend && npm run dev"
echo ""


