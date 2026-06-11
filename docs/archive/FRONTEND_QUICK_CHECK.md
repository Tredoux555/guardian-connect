# Frontend Quick Check - 5 Steps

## 🎯 Quick Steps to Check Frontend

### 1️⃣ Find It
- Railway → Projects → "guardian-connect"
- Look for service named: **"web-user"**, **"frontend"**, or similar (NOT "backend")

### 2️⃣ Check Status
- Click on frontend service
- Status should be: ✅ **"Active"** or **"Running"**
- If ❌ "Crashed" → Check Logs tab

### 3️⃣ Check URL
- Settings tab → "Domains" section
- Do you see a URL? (e.g., `https://xxx.up.railway.app`)
- ❌ No URL? → Click "Generate Domain"

### 4️⃣ Check Environment Variable
- Variables tab → Look for `VITE_API_URL`
- Should be: `https://your-backend-url.railway.app/api`
- ❌ Missing or wrong? → Add/Update it

### 5️⃣ Test It
- Copy frontend URL from Settings → Domains
- Open in browser
- Should see: ✅ Login/Registration page

---

## 🚨 If Frontend Service Doesn't Exist

1. Click **"+ New"** in Railway project
2. Select **"GitHub Repo"**
3. Choose **"guardian-connect"**
4. Set **Root Directory** to: `web-user`
5. Add `VITE_API_URL` variable (pointing to backend URL)
6. Generate domain

---

**Full guide:** See `CHECK_FRONTEND_STATUS.md` for detailed steps

