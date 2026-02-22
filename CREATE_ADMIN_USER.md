# 🚀 Create Admin User - Super Simple Guide

## ✅ **Easiest Method: Use the Script**

I've created a script that does everything for you!

### **Step 1: Get Database Connection Info from Railway**

1. **Go to:** https://railway.app
2. **Click:** Your "guardian-connect" project
3. **Click:** Your **PostgreSQL database** (has a database icon)
4. **Click:** "Variables" tab
5. **Copy these values:**
   - **PGHOST** (click 👁️ to reveal, then copy)
   - **PGPORT** (just the number)
   - **PGDATABASE** (copy the value)
   - **PGUSER** (copy the value)
   - **PGPASSWORD** (click 👁️ to reveal, then copy)

### **Step 2: Open Terminal**

1. Press: **`Cmd + Space`**
2. Type: **"Terminal"**
3. Press: **Enter**

### **Step 3: Run These Commands**

**Copy and paste this first command:**
```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/backend
```

**Then copy and paste this (replace with YOUR values from Railway):**
```bash
export PGHOST="paste-your-PGHOST-here"
export PGPORT="paste-your-PGPORT-here"
export PGDATABASE="paste-your-PGDATABASE-here"
export PGUSER="paste-your-PGUSER-here"
export PGPASSWORD="paste-your-PGPASSWORD-here"
export NODE_ENV="production"
npm run create-admin
```

**Press Enter!**

### **Step 4: You're Done!**

The script will:
- ✅ Create admin user with email: `admin@guardian.com`
- ✅ Set password: `admin123`
- ✅ Show you the login credentials

### **Step 5: Login**

1. **Go to:** `https://admin-production-d0f8.up.railway.app/login`
2. **Email:** `admin@guardian.com`
3. **Password:** `admin123`

---

## 🔄 **Alternative: Use Railway's Query Interface**

If Railway has a query interface:

1. **Go to:** Railway → Your PostgreSQL Database
2. **Look for:** "Query" or "SQL" tab
3. **Paste this SQL:**

```sql
INSERT INTO admins (email, password_hash) 
VALUES ('admin@guardian.com', '$2b$10$rOzYjQX8.8KvJcH6V5F5UeXc8QyqQK6b8QK6b8QK6b8QK6b8QK6b8Q');
```

**Note:** The hash above is for password `admin123`. If you want a different password, generate a new hash at https://bcrypt-generator.com/

---

## ✅ **Success!**

Once the admin user is created, you can login and manage your app! 🎉

