# Coordinate Accuracy Diagnostics Guide

## Checkpoint Created

✅ **Checkpoint Tag**: `v1.0-maps-working`
- Google Maps loading working on Safari and Chrome
- Manual script injection successful
- To rollback: `git checkout v1.0-maps-working`

## Comprehensive Coordinate Tracing

I've added detailed logging at every step of the coordinate flow. When you trigger an emergency, you'll see logs like:

### Step 1: Device GPS (Home.tsx)
```
🔍 [COORDINATE TRACE] Step 1 - Device GPS
```
- Shows exact coordinates from `navigator.geolocation`
- This is the SOURCE OF TRUTH from your device

### Step 2: Sending to Backend (Home.tsx)
```
🔍 [COORDINATE TRACE] Step 2 - Sending to backend
```
- Shows what's being sent in the API request
- Should match Step 1 exactly

### Step 3: Backend Received (emergencies.ts)
```
🔍 [COORDINATE TRACE] Step 2 - Backend received from client
```
- Shows what backend receives
- Should match Step 2

### Step 4: Backend Parsed & Stored (emergencies.ts)
```
🔍 [COORDINATE TRACE] Step 3 - Backend parsed coordinates
🔍 [COORDINATE TRACE] Step 4 - Backend stored in database
```
- Shows parsing and storage
- Database stores as DECIMAL(10,8) and DECIMAL(11,8)

### Step 5: Backend Retrieved (Emergency.ts)
```
🔍 [COORDINATE TRACE] Step 5 - Backend retrieved from database
```
- Shows what database returns
- May be string or number depending on PostgreSQL driver

### Step 6: Frontend Received (EmergencyActive.tsx)
```
🔍 [COORDINATE TRACE] Step 4 - Locations received from API
```
- Shows what frontend receives from API
- Should match Step 5

### Step 7: Frontend Parsed (EmergencyActive.tsx)
```
🔍 [COORDINATE TRACE] Step 5 - Parsed coordinates
🔍 [COORDINATE TRACE] Step 6 - Sender location (final)
```
- Shows parsing in frontend
- Shows sender location details

### Step 8: URL Generation (EmergencyActive.tsx)
```
🔍 [COORDINATE TRACE] Step 7 - getGoogleMapsUrl called with
🔍 [COORDINATE TRACE] Step 8 - Formatted coordinates
🔍 [COORDINATE TRACE] Step 9 - Final Google Maps URL
```
- Shows URL generation
- Shows final URL with all coordinate details

## What to Provide for Diagnosis

When you test, please provide:

1. **Console logs** - Look for all `🔍 [COORDINATE TRACE]` entries
2. **Compare coordinates** at each step:
   - Step 1 (Device) vs Step 2 (Sent)
   - Step 2 (Sent) vs Step 3 (Backend received)
   - Step 4 (Stored) vs Step 5 (Retrieved)
   - Step 5 (Retrieved) vs Step 6 (Frontend received)
   - Step 6 (Frontend) vs Step 9 (Final URL)

3. **Visual check**:
   - Where does the map marker appear? (should be correct)
   - Where does Google Maps navigate to? (currently ~1km off)
   - What's the actual distance between marker and navigation point?

4. **Database query** (optional, if you have access):
```sql
SELECT 
  latitude, 
  longitude,
  latitude::text as lat_text,
  longitude::text as lng_text,
  pg_typeof(latitude) as lat_type,
  pg_typeof(longitude) as lng_type
FROM emergency_locations 
ORDER BY timestamp DESC 
LIMIT 1;
```

## Expected Findings

The logs will show us:
- ✅ If coordinates are correct at device level
- ✅ If coordinates are lost/changed during transmission
- ✅ If database storage is correct
- ✅ If database retrieval is correct
- ✅ If frontend parsing is correct
- ✅ If URL formatting is correct
- ❌ **Where the ~1km offset is introduced**

## Possible Causes

1. **Coordinate system mismatch** - Device uses WGS84, but something converts it
2. **Precision loss** - Rounding at some step
3. **Google Maps interpretation** - URL format issue
4. **Database rounding** - DECIMAL precision issue
5. **String/number conversion** - Type conversion loses precision

## Next Steps

1. Test on mobile device
2. Trigger an emergency
3. Open Google Maps directions
4. Share all console logs (frontend and backend)
5. Compare coordinates at each step
6. Identify where the offset is introduced
7. Fix the specific step causing the issue

