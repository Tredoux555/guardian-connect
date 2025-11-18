# Backend Build Documentation

## Build Output Structure

TypeScript compiles source files from `src/` to `dist/src/` (preserving directory structure).

**Important:** The server entry point is at `dist/src/server.js`, NOT `dist/server.js`.

```
backend/
├── src/
│   └── server.ts          # Source file
├── dist/
│   └── src/
│       └── server.js      # Compiled output (THIS IS THE ENTRY POINT)
└── package.json
```

## Configuration Files Priority

Railway uses configuration files in this order (first found wins):

1. **railway.json** - Highest priority, explicitly sets start command
2. **Procfile** - Fallback if railway.json doesn't specify
3. **nixpacks.toml** - Used by Nixpacks builder
4. **package.json** start script - Last resort

All configuration files must point to `dist/src/server.js` to be consistent.

## Current Configuration

### railway.json
```json
{
  "deploy": {
    "startCommand": "node dist/src/server.js"
  }
}
```

### Procfile
```
web: node dist/src/server.js
```

### nixpacks.toml
```toml
[start]
cmd = "node dist/src/server.js"
```

### package.json
```json
{
  "main": "dist/src/server.js",
  "scripts": {
    "start": "node dist/src/server.js",
    "postbuild": "node -e \"require('fs').accessSync('dist/src/server.js')\" || exit 1"
  }
}
```

## Build Process

1. **Install dependencies:** `npm install`
2. **Compile TypeScript:** `npm run build` (runs `tsc`)
3. **Verify build:** `npm run postbuild` (automatically runs after build)
4. **Start server:** `npm start` or `node dist/src/server.js`

## Build Verification

The `postbuild` script verifies that `dist/src/server.js` exists after compilation. If the file is missing, the build fails with an error, preventing deployment of broken builds.

## Troubleshooting

### Error: Cannot find module '/app/dist/server.js'

**Cause:** Configuration is pointing to wrong path.

**Solution:** Check all configuration files:
- `railway.json` startCommand
- `Procfile` web command
- `nixpacks.toml` start cmd
- `package.json` main and start script

All should point to `dist/src/server.js`.

### Build succeeds but server won't start

1. Check build output: `ls -la dist/src/server.js`
2. Verify file exists: `test -f dist/src/server.js && echo "OK" || echo "MISSING"`
3. Check postbuild script ran: Look for "ERROR: dist/src/server.js not found" in build logs

### Railway still using old path

1. Clear Railway build cache in service settings
2. Force redeploy from latest commit
3. Verify latest commit has correct configuration files

## Why dist/src/ and not dist/?

TypeScript's `tsc` compiler preserves the source directory structure when compiling. Since source files are in `src/`, compiled output goes to `dist/src/`. This is the default behavior and changing it would require modifying `tsconfig.json` rootDir, which could break imports.

## Maintenance

When updating start commands:
1. Update ALL configuration files (railway.json, Procfile, nixpacks.toml, package.json)
2. Keep them consistent - all should use `dist/src/server.js`
3. Test locally: `npm run build && npm start`
4. Verify postbuild script passes

