# 🌙 MARATHON COMMAND — Guardian Connect Overnight Rebuild
**Written by Claude, for Claude. Tredoux will start a fresh session and point it here. Execute autonomously.**

---

## YOUR MISSION

You have the whole night and a free hand. Guardian Connect is NOT an active project — **if it breaks, that's fine.** Cut, chop, simplify, rebuild, revamp. Bias to action: when a judgment call comes up, make the bold-but-sensible choice, log it, and keep moving. Work in long loops: **ANALYSE → FIX/BUILD → AUDIT → repeat**, phase by phase, until the product is launch-ready per this document.

**Project location**
- File tools (Read/Write/Edit/Grep/Glob): `/Users/tredouxwillemse/Desktop/Master Brain/ACTIVE/guardian-connect`
- bash: `/sessions/<session>/mnt/...` equivalent — check your Shell-access mapping; Desktop is mounted
- Read first: `LAUNCH_AUDIT_Jun11_2026.md` (the audit), `SIMPLIFICATION_ROADMAP.md`, `README.md`, `HANDOFF_DEC30_2025.md`
- Stack: backend/ (Node+TS+Postgres+Socket.io), web-user/ (React/Vite), admin/ (React), mobile/ (Flutter — LOW priority), shared/

**Live deployment (do not deploy to it tonight — work locally, commit to git)**
- Backend: back-end-production-4a69.up.railway.app · Web: web-user-production.up.railway.app
- Domain guardianconnect.icu owned, DNS unfinished. Railway deploy is a MORNING task for Tredoux to approve.

---

## PRODUCT DECISIONS FROM TREDOUX (these override the old design — do not relitigate)

1. **Live location streaming is OUT.** Emergencies are seldom mobile. The emergency location is **STATIC**:
   captured ONCE at trigger time (lat, lng, accuracy, timestamp) and stored on the emergency record.
   Add a manual "Update my location" button for the rare case. Rip out high-frequency location streams,
   1-meter updates, location websocket spam — all of it. Simplicity =