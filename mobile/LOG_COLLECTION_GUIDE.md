# Comprehensive Log Collection System

## Overview

The app now includes a comprehensive log collection system that captures logs from all sources (mobile, backend, socket, location, emergency, chat, API) and provides a diagnostic tool to analyze them.

## Features

### 1. Automatic Log Collection
- **Starts automatically** when the app launches
- Captures all logs from:
  - Location services (GPS, permissions, coordinates)
  - Emergency operations (creation, updates, ending)
  - Socket connections (connect, disconnect, events)
  - API calls (requests, responses, errors)
  - Chat messages (send, receive, errors)
  - System events (errors, warnings)

### 2. Log Sources

#### Location Logs (`LogSource.location`)
- GPS accuracy readings
- Coordinate updates
- Permission status
- Location service errors
- Includes metadata: latitude, longitude, accuracy, timestamp

#### Emergency Logs (`LogSource.emergency`)
- Emergency creation
- Status updates
- Location sharing
- Emergency ending

#### Socket Logs (`LogSource.socket`)
- Connection attempts
- Connection status
- Event emissions
- Disconnections

#### API Logs (`LogSource.api`)
- HTTP requests
- Response status codes
- Error responses
- Request/response data

#### Chat Logs (`LogSource.chat`)
- Message sending
- Message receiving
- File uploads
- Errors

### 3. Diagnostic Screen

Access the diagnostic screen from the Home Screen:
- Tap the **bug report icon** (🐛) in the top-right AppBar

#### Tests Tab
- Run 9 comprehensive diagnostic tests
- View pass/fail results with detailed data
- Export all test results as JSON

#### Logs Tab
- View all collected logs in real-time
- Filter by source: All, Location, Emergency, Socket, API, Chat, Errors
- Search logs by keyword
- View log details with metadata
- Export location logs specifically

### 4. Log Filtering

The diagnostic screen provides multiple ways to filter logs:

1. **By Source**: Filter to see only location, emergency, socket, API, chat, or error logs
2. **By Search**: Search logs by keyword (searches message and category)
3. **By Time**: View logs from a specific time period

### 5. Export Functionality

#### Export All Diagnostic Data
- Includes: test results, all logs, statistics, location logs, error logs
- Tap the **copy icon** in the Tests tab
- Data is formatted as JSON

#### Export Location Logs Only
- Tap the **location icon** in the Logs tab
- Exports only location-related logs with full metadata

## Usage for Location Issues

### Step 1: Start Log Collection
Log collection starts automatically when the app launches. No action needed.

### Step 2: Reproduce the Issue
1. Create an emergency
2. Share location
3. View the emergency on receiver side
4. Note any location-related issues

### Step 3: View Logs
1. Open Diagnostic Screen (bug icon)
2. Go to **Logs** tab
3. Filter by **Location** to see only location logs
4. Review logs to identify issues:
   - Check for error logs (red)
   - Look for coordinate values
   - Check accuracy readings
   - Review permission status

### Step 4: Export and Share
1. Tap **location icon** to copy location logs
2. Share the exported JSON for analysis

## Log Levels

- **Debug** (🔍): Detailed information for debugging
- **Info** (ℹ️): General information
- **Warning** (⚠️): Warnings that don't prevent functionality
- **Error** (❌): Errors that may affect functionality

## Log Metadata

Each log entry includes:
- **Timestamp**: Exact time of the log
- **Source**: Where the log came from
- **Level**: Severity level
- **Message**: Human-readable message
- **Category**: Optional category (e.g., "Location", "Emergency")
- **Metadata**: Additional structured data (coordinates, accuracy, etc.)

## Example Location Log Entry

```json
{
  "timestamp": "2025-12-02T10:30:45.123Z",
  "source": "location",
  "level": "info",
  "message": "Location obtained: 37.785834, -122.406417 (accuracy: 5.0m)",
  "category": "Location",
  "metadata": {
    "latitude": 37.785834,
    "longitude": -122.406417,
    "accuracy": 5.0,
    "altitude": 10.5,
    "speed": 0.0,
    "heading": 0.0,
    "timestamp": "2025-12-02T10:30:45.000Z"
  }
}
```

## Integration Points

### Location Service
All location operations are logged:
- `getCurrentLocation()` - logs permission checks, GPS accuracy, coordinates
- `getEmergencyLocation()` - logs emergency-specific location requests
- `getLocationStream()` - logs stream initialization
- `getEmergencyLocationStream()` - logs emergency stream initialization

### Emergency Active Screen
Location-related operations are logged:
- Location permission checks
- Current position updates
- Emergency location loading
- Map centering
- Coordinate validation

### API Service
API calls can be logged using `LogCollector.logApi()`:
- Request URLs
- Response status codes
- Error messages

### Socket Service
Socket operations can be logged using `LogCollector.logSocket()`:
- Connection attempts
- Event emissions
- Disconnections

## Troubleshooting

### No Logs Appearing
1. Check that log collection is started (should be automatic)
2. Verify the app is running (logs only collect when app is active)
3. Check the filter settings (might be filtering out logs)

### Too Many Logs
- Use filters to narrow down to specific sources
- Use search to find specific events
- Clear logs periodically if needed

### Missing Location Logs
- Ensure location permissions are granted
- Check that location services are enabled
- Verify GPS is working (check device settings)

## Best Practices

1. **Before Reporting Issues**: Export location logs and include them in bug reports
2. **During Testing**: Keep the diagnostic screen open to monitor logs in real-time
3. **After Fixes**: Clear logs and test again to see if issues are resolved
4. **For Analysis**: Export logs and analyze the JSON structure to identify patterns

## Next Steps

When investigating location issues:
1. Open diagnostic screen
2. Filter to location logs
3. Reproduce the issue
4. Export location logs
5. Share exported data for analysis

The log collection system will automatically capture all relevant information needed to diagnose and fix location-related problems.




