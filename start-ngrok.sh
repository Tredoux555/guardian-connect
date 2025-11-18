#!/bin/bash
echo "🚀 Starting ngrok for Guardian Connect..."
echo ""
echo "This will create an HTTPS tunnel to your frontend (port 3003)"
echo "You'll get an HTTPS URL to use on your phone"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""
ngrok http 3003
