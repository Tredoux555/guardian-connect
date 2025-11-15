# Auto-Restart Backend Note

**User Preference:** Restart backend server automatically after code changes.

## Current Process

When backend code changes are made:
1. Backend server needs to be restarted manually
2. User will restart in their terminal: `Ctrl + C` then `npm run dev`

## Future Improvement

Consider using `nodemon` or `ts-node-dev` (already in use) which auto-restarts on file changes.

Current setup uses `ts-node-dev` which should auto-restart, but sometimes manual restart is needed for:
- Middleware changes
- Route changes
- Configuration changes
- Database schema changes

## Quick Restart Commands

```bash
# Stop server: Ctrl + C
# Start server:
cd ~/Desktop/guardian-connect/backend
npm run dev
```






