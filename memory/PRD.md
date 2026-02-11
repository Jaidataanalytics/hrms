# Sharda HR - Product Requirements Document

## Original Problem Statement
Modern HR management platform with premium UI, mobile app support, and push notifications.

## Authentication
- JWT + Emergent Google Auth
- Admin: admin@shardahr.com / Admin@123 | Employee: employee@shardahr.com / Employee@123

## Tech Stack
- Frontend: React, TailwindCSS, Shadcn/UI, Framer Motion, Lucide icons, Capacitor
- Backend: FastAPI, Motor (async MongoDB), openpyxl, reportlab
- Mobile: Capacitor 6 (Android WebView wrapper), Firebase FCM
- 3rd Party: emergentintegrations, Custom Biometric API, Emergent Google Auth

---

## What's Been Implemented

### Mobile App Setup (NEW - Feb 11, 2026)
- Capacitor 6 configured for Android (`com.shardahr.app`)
- Backend URL points to `https://shardahrms.com`
- Mobile bottom navigation: Home, Attendance, Leave, Helpdesk, More
- Hamburger menu opens full sidebar for accessing all pages
- Native plugins: Geolocation, Push Notifications, Status Bar, Splash Screen
- `nativeServices.js` — abstraction layer for push/GPS with web fallback
- Build guide at `frontend/MOBILE_BUILD_GUIDE.md`

### Push Notification Backend (NEW - Feb 11, 2026)
- `/api/push/register-token` — register FCM device token
- `/api/push/unregister-token` — remove token on logout
- `send_push_to_user()` / `send_push_to_employee()` — helper functions
- Ready for Firebase FCM integration (needs `FIREBASE_SERVER_KEY` in .env)

### Light Glass-Morphism UI
- Frosted glass cards with backdrop-blur on light background
- Bold hover animations (3px lift, glow effects)
- Neon glow on primary buttons
- Glass dialogs, tabs, dropdowns, inputs
- Dark sidebar as contrast anchor

### Employee Features
- Sidebar access: Helpdesk, SOPs, Training, Tour Management
- Remote check-in dashboard shortcut with GPS
- Auth headers fix for cross-domain (11 pages patched)

### Previous: Helpdesk Phase 2, Celebrations, Attendance fixes, etc.

---

## Pending Setup (User Action Required)
1. **Firebase project** — Create at console.firebase.google.com, get `google-services.json` + Server Key
2. **Set `FIREBASE_SERVER_KEY`** in backend `.env`
3. **Build APK** — Follow `MOBILE_BUILD_GUIDE.md` (requires Android Studio on local machine)
4. **Redeploy** — CORS fix for custom domain

## Prioritized Backlog
### P1
- [ ] Wire push notifications into existing event handlers (leave approved, announcements, etc.)
- [ ] Production deployment
- [ ] Admin "Unknown" name in meeting analytics

### P2
- [ ] Bulk import, Helpdesk Phase 3, employee deduplication
- [ ] HelpdeskPage.js refactoring
