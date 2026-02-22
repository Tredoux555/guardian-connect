#!/bin/bash
# ============================================
# Guardian Connect - Railway Deployment Script
# Run this from: ~/Desktop/ACTIVE/guardian-connect
# ============================================

set -e

echo "=========================================="
echo "🚀 Guardian Connect - Railway Deployment"
echo "=========================================="
echo ""

# ---- Step 1: Check/Install Railway CLI ----
echo "📦 Step 1: Checking Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo "   Installing Railway CLI..."
    brew install railway 2>/dev/null || npm install -g @railway/cli
    echo "   ✅ Railway CLI installed"
else
    echo "   ✅ Railway CLI already installed"
fi

# ---- Step 2: Login to Railway ----
echo ""
echo "🔐 Step 2: Logging into Railway..."
echo "   (A browser window will open - log in with your Railway account)"
railway login
echo "   ✅ Logged in"

# ---- Step 3: Create/Link Project ----
echo ""
echo "🏗️  Step 3: Setting up Railway project..."
echo ""
echo "Choose an option:"
echo "  1) Create a NEW Railway project for guardian-connect"
echo "  2) Link to an EXISTING Railway project"
read -p "Enter choice (1 or 2): " PROJECT_CHOICE

if [ "$PROJECT_CHOICE" = "1" ]; then
    echo "   Creating new project..."
    railway init --name guardian-connect
    echo "   ✅ Project created"
else
    echo "   Linking to existing project..."
    railway link
    echo "   ✅ Project linked"
fi

# ---- Step 4: Add PostgreSQL Database ----
echo ""
echo "🗄️  Step 4: Adding PostgreSQL database..."
railway add --plugin postgresql
echo "   ✅ PostgreSQL added"
echo ""
echo "   ⏳ Waiting 10 seconds for database to provision..."
sleep 10

# ---- Step 5: Run Schema on Database ----
echo ""
echo "📋 Step 5: Setting up database schema..."
echo "   Running schema.sql against Railway PostgreSQL..."

# Get the DATABASE_URL from Railway
DB_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")
if [ -n "$DB_URL" ]; then
    echo "   Found DATABASE_URL, applying schema..."
    psql "$DB_URL" < backend/src/database/schema.sql
    echo "   ✅ Schema applied"

    # Run migrations
    echo "   Running migrations..."
    for migration in backend/src/database/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo "   Applying: $(basename $migration)"
            psql "$DB_URL" < "$migration" 2>/dev/null || echo "   (already applied or skipped)"
        fi
    done
    echo "   ✅ Migrations complete"
else
    echo "   ⚠️  Could not get DATABASE_URL automatically."
    echo "   You'll need to run the schema manually later."
    echo "   See instructions at the end of this script."
fi

# ---- Step 6: Deploy Backend ----
echo ""
echo "🔧 Step 6: Deploying backend..."
echo "   Setting environment variables..."

# Generate new JWT secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

cd backend

# Create the backend service
railway service create backend 2>/dev/null || echo "   (service may already exist)"
railway service backend 2>/dev/null || true

# Set env vars
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"

echo "   Deploying backend code..."
railway up --detach

cd ..
echo "   ✅ Backend deployment started"

# ---- Step 7: Deploy Web User Frontend ----
echo ""
echo "🌐 Step 7: Deploying web-user frontend..."

cd web-user

railway service create web-user 2>/dev/null || echo "   (service may already exist)"
railway service web-user 2>/dev/null || true

echo "   Deploying web-user code..."
railway up --detach

cd ..
echo "   ✅ Web-user deployment started"

# ---- Step 8: Deploy Admin Panel ----
echo ""
echo "👨‍💼 Step 8: Deploying admin panel..."

cd admin

railway service create admin 2>/dev/null || echo "   (service may already exist)"
railway service admin 2>/dev/null || true

echo "   Deploying admin code..."
railway up --detach

cd ..
echo "   ✅ Admin deployment started"

# ---- Step 9: Generate Domains ----
echo ""
echo "🌍 Step 9: Generating domains..."
echo "   You'll need to generate domains for each service in the Railway dashboard."
echo ""

# ---- Done ----
echo ""
echo "=========================================="
echo "✅ DEPLOYMENT INITIATED!"
echo "=========================================="
echo ""
echo "📋 NEXT STEPS (do these in Railway dashboard):"
echo ""
echo "1. Go to: https://railway.app/dashboard"
echo "2. Open your guardian-connect project"
echo ""
echo "3. FOR EACH SERVICE, generate a domain:"
echo "   - Click service → Settings → Domains → Generate Domain"
echo "   - Backend: will get something like backend-xxx.up.railway.app"
echo "   - Web-user: will get something like web-user-xxx.up.railway.app"
echo "   - Admin: will get something like admin-xxx.up.railway.app"
echo ""
echo "4. UPDATE CORS on backend:"
echo "   - Backend → Variables → Add:"
echo "     ALLOWED_ORIGINS=https://web-user-xxx.up.railway.app,https://admin-xxx.up.railway.app"
echo ""
echo "5. UPDATE API URL on frontends:"
echo "   - Web-user → Variables → Add:"
echo "     VITE_API_URL=https://backend-xxx.up.railway.app/api"
echo "   - Admin → Variables → Add:"
echo "     VITE_API_URL=https://backend-xxx.up.railway.app/api"
echo ""
echo "6. OPTIONAL - Custom domain (guardianconnect.icu):"
echo "   - Add custom domains in Railway → Settings → Domains"
echo "   - Update GoDaddy DNS CNAME records to point to Railway"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo ""
echo "🔑 Save these JWT secrets somewhere safe!"
echo "=========================================="
