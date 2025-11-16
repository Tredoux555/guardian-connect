# Feature Flags Setup Guide

## Overview

Both **Donations** and **Subscriptions** features are fully implemented but **hidden by default**. You can enable them when your financial structure is ready.

## How to Enable/Disable Features

### Backend Feature Flags

Add to `backend/.env`:
```env
# Feature flags (set to true to enable, false to disable)
ENABLE_DONATIONS=false
ENABLE_SUBSCRIPTIONS=false
```

**When ready to enable:**
```env
ENABLE_DONATIONS=true
ENABLE_SUBSCRIPTIONS=true
```

### Frontend Feature Flags

Add to `web-user/.env`:
```env
# Feature flags (set to true to enable, false to disable)
VITE_ENABLE_DONATIONS=false
VITE_ENABLE_SUBSCRIPTIONS=false
```

**When ready to enable:**
```env
VITE_ENABLE_DONATIONS=true
VITE_ENABLE_SUBSCRIPTIONS=true
```

## What Happens When Disabled?

### Backend:
- All donation routes return 404
- All subscription routes return 404 (except `/plans` which can be previewed)
- Features are completely hidden from API

### Frontend:
- Donation and Subscription links don't appear in navigation
- Routes are not accessible
- Features are completely hidden from UI

## Testing Features (While Hidden)

Even when disabled, you can test the implementation:

1. **Temporarily enable in `.env` files**
2. **Test the features**
3. **Disable again** when done

## Current Status

✅ **Donations**: Fully implemented, hidden by default
✅ **Subscriptions**: Fully implemented, hidden by default
✅ **Feature Flags**: Working on both backend and frontend

## When You're Ready

1. **Set up payment platform** (Hong Kong + Stripe recommended)
2. **Get Stripe API keys**
3. **Add keys to `.env` files**
4. **Run database migrations**
5. **Change feature flags to `true`**
6. **Test in test mode**
7. **Go live!**

---

**Note**: Features are production-ready, just waiting for your financial setup!

