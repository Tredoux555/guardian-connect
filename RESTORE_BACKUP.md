# Quick Restore Guide

## Restore Backup from November 15, 2025

### Git Commit Hash
```
4966719
```

### Quick Restore Command
```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect
git reset --hard 4966719
```

### What This Restores
- All code files to the state at backup time
- Configuration files (except `.env` files - these are typically gitignored)
- All working features as documented in `BACKUP_2025-11-15.md`

### After Restoring

1. **Restore Environment Variables:**
   - Check `.env` files in `backend/`, `web-user/`, and `admin/` directories
   - Ensure they have the correct values (see BACKUP_2025-11-15.md)

2. **Reinstall Dependencies (if needed):**
   ```bash
   cd backend && npm install
   cd ../web-user && npm install
   cd ../admin && npm install
   ```

3. **Restart Servers:**
   ```bash
   # Backend
   cd backend && npm run dev
   
   # Web User
   cd web-user && npm run dev
   
   # Admin Panel
   cd admin && npm run dev
   ```

4. **Verify Database:**
   - Ensure PostgreSQL is running
   - Database `guardian_connect` exists
   - Run migrations if needed

### ⚠️ Warning
Using `git reset --hard` will **permanently delete** any uncommitted changes made after this backup point. Make sure you want to discard those changes!

### Alternative: Create a Branch
If you want to keep current changes:
```bash
git branch current-work  # Save current state
git reset --hard 4966719  # Restore backup
```

To return to your work:
```bash
git checkout current-work
```

