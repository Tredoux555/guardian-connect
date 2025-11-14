# PostgreSQL Setup Guide for Beginners

## What is PostgreSQL?

PostgreSQL (often called "Postgres") is a database - think of it as a digital filing cabinet where your app stores all its data (users, emergencies, contacts, etc.).

## Step 1: Check if PostgreSQL is Already Installed

First, let's check if you already have PostgreSQL installed on your Mac.

Open Terminal (press `Cmd + Space`, type "Terminal", press Enter) and run:

```bash
which psql
```

**If you see something like `/usr/local/bin/psql` or `/opt/homebrew/bin/psql`:**
✅ PostgreSQL is installed! Skip to Step 2.

**If you see `psql: command not found`:**
❌ PostgreSQL is not installed. Continue to Step 1.5.

---

## Step 1.5: Install PostgreSQL (Only if Not Installed)

### Option A: Install Using Homebrew (Recommended)

1. **First, check if you have Homebrew:**
   ```bash
   which brew
   ```
   
   If you see a path (like `/opt/homebrew/bin/brew`), you have Homebrew! Skip to step 3.
   
   If you see "brew: command not found", install Homebrew first:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   (This will ask for your password - type it and press Enter)

2. **Install PostgreSQL:**
   ```bash
   brew install postgresql@14
   ```

3. **Start PostgreSQL service:**
   ```bash
   brew services start postgresql@14
   ```

4. **Add PostgreSQL to your PATH** (so Terminal can find it):
   ```bash
   echo 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

### Option B: Install Using Postgres.app (Easier for Beginners)

1. **Download Postgres.app:**
   - Go to: https://postgresapp.com/
   - Download the Mac version
   - Drag it to your Applications folder

2. **Open Postgres.app:**
   - Double-click it in Applications
   - Click "Initialize" to create a new server
   - The server should start automatically

3. **Add to PATH:**
   ```bash
   sudo mkdir -p /etc/paths.d &&
   echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
   ```

---

## Step 2: Verify PostgreSQL is Working

Run this command to check if PostgreSQL is running:

```bash
psql --version
```

You should see something like: `psql (PostgreSQL) 14.x`

If you see an error, try:
```bash
# If using Homebrew:
brew services restart postgresql@14

# If using Postgres.app:
# Just make sure the app is open and running
```

---

## Step 3: Create the Database

Now we'll create a database called "guardian_connect" for your app.

### Step 3.1: Connect to PostgreSQL

Run this command:
```bash
psql postgres
```

**What this does:** Connects you to the default PostgreSQL database so you can run commands.

**If you see an error like "role does not exist":**
- You might need to create a user first. Try:
  ```bash
  createuser -s $USER
  ```
  Then try `psql postgres` again.

**If you see an error like "could not connect to server":**
- PostgreSQL might not be running. Start it:
  ```bash
  # Homebrew:
  brew services start postgresql@14
  
  # Postgres.app:
  # Just open the app
  ```

### Step 3.2: Create the Database

Once you're connected (you'll see `postgres=#`), type:

```sql
CREATE DATABASE guardian_connect;
```

Press Enter. You should see: `CREATE DATABASE`

### Step 3.3: Exit PostgreSQL

Type:
```sql
\q
```

Press Enter. You're back in Terminal.

---

## Step 4: Run the Schema File

The schema file contains all the table definitions (like blueprints for your database).

### Step 4.1: Navigate to Your Project

Make sure you're in the project directory:
```bash
cd ~/Desktop/guardian-connect
```

### Step 4.2: Run the Schema

Run this command:
```bash
psql guardian_connect < backend/src/database/schema.sql
```

**What this does:**
- `psql guardian_connect` - Connects to your database
- `< backend/src/database/schema.sql` - Runs the SQL commands from that file

**If successful:** You won't see any output (that's normal!)

**If you see errors:**
- Make sure you're in the right directory (`~/Desktop/guardian-connect`)
- Make sure the file exists: `ls backend/src/database/schema.sql`
- Check the error message - it will tell you what went wrong

---

## Step 5: Verify Everything Worked

Let's check that the tables were created:

```bash
psql guardian_connect
```

Then run:
```sql
\dt
```

**You should see a list of tables like:**
```
                  List of relations
 Schema |         Name          | Type  | Owner
--------+-----------------------+-------+-------
 public | admins                | table | your_username
 public | email_verifications   | table | your_username
 public | emergency_contacts    | table | your_username
 public | emergency_locations    | table | your_username
 public | emergency_messages    | table | your_username
 public | emergency_participants| table | your_username
 public | emergencies           | table | your_username
 public | password_resets       | table | your_username
 public | sessions              | table | your_username
 public | users                 | table | your_username
```

If you see these tables, **SUCCESS!** ✅

Exit with:
```sql
\q
```

---

## Step 6: Update Your Backend .env File

Now you need to tell your backend app how to connect to the database.

1. **Open the .env file:**
   ```bash
   cd backend
   nano .env
   ```
   (Or use any text editor like VS Code, TextEdit, etc.)

2. **Update these lines:**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=guardian_connect
   DB_USER=your_mac_username
   DB_PASSWORD=
   ```

   **To find your Mac username:**
   ```bash
   whoami
   ```
   Use that value for `DB_USER`.

   **For DB_PASSWORD:** 
   - If you installed via Homebrew or Postgres.app, leave it empty (no password by default)
   - If you set a password during installation, use that

3. **Save the file:**
   - In nano: Press `Ctrl + X`, then `Y`, then Enter
   - In other editors: Just save normally

---

## Common Issues & Solutions

### Issue: "psql: command not found"
**Solution:** PostgreSQL is not in your PATH. See Step 1.5 for installation.

### Issue: "could not connect to server"
**Solution:** PostgreSQL is not running.
```bash
# Check if it's running:
brew services list

# Start it:
brew services start postgresql@14
```

### Issue: "database guardian_connect does not exist"
**Solution:** You need to create it first (Step 3.2).

### Issue: "permission denied"
**Solution:** You might need to create a PostgreSQL user:
```bash
createuser -s $USER
```

### Issue: "relation already exists"
**Solution:** The tables already exist. This is fine! You can either:
- Ignore it (tables are already there)
- Or drop and recreate:
  ```bash
  psql guardian_connect -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  psql guardian_connect < backend/src/database/schema.sql
  ```

---

## Quick Reference Commands

```bash
# Check if PostgreSQL is installed
psql --version

# Start PostgreSQL (Homebrew)
brew services start postgresql@14

# Connect to database
psql guardian_connect

# List all tables
\dt

# Exit PostgreSQL
\q

# Run SQL file
psql guardian_connect < path/to/file.sql
```

---

## Next Steps

Once PostgreSQL is set up:
1. ✅ Database created
2. ✅ Tables created
3. ✅ Backend .env configured
4. ➡️ Continue with the rest of the setup guide!

If you get stuck, check the error message - it usually tells you exactly what's wrong!


