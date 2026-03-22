# NOVAHIT AI — COMPLETE SYSTEM FLOW

**Purpose:** Map user journey from entry → song delivery. Identify all latency points.

---

## 🔄 COMPLETE USER JOURNEY

### PHASE 1: ENTRY & AUTHENTICATION
```
1. User opens https://novahitmusic.vercel.app
   └─ index.html loads (cached, ~100ms)
   └─ JavaScript initializes (DOM ready)
   └─ Check localStorage['novahit_email']
      ├─ If found: Skip email modal
      └─ If not found: Show email modal

2. EMAIL MODAL (if new user)
   ├─ User enters: test@example.com
   ├─ Click "Devam Et →" button
   ├─ Call: /api/auth { email, action: "check" }
   │  └─ Vercel function latency: ~500-800ms
   │     ├─ Check Redis quota
   │     └─ Create user if needed (Supabase POST)
   ├─ Response: { allowed: true, songs_used: 0, songs_limit: 3 }
   ├─ Save to localStorage['novahit_email']
   └─ Modal closes, main UI appears

   ⏱️ TOTAL: ~1-1.5 sec
```

### PHASE 2: SONG WIZARD (5-Step Configuration)

```
STEP 1: EMOTION SELECT
├─ User clicks emotion chip (💔 Hüzün, ❤️ Aşk, etc.)
│  └─ onclick="selectEmotion(this)" → store selection
├─ Visual feedback: Chip highlights (active class)
├─ Click "Devam →" button
└─ Move to Step 2

STEP 2: POWER MODE
├─ Click power card (Standart, Hit Modu, Viral Modu)
│  └─ onclick="selectPower(this)" → store selection
├─ Visual feedback: Card border glows
├─ Click "Devam →"
└─ Move to Step 3

STEP 3: LYRICS SOURCE
├─ Toggle buttons: "Novahit" vs "Ben"
│  └─ onclick="setLyrics('novahit'|'ben')"
├─ Active button shows highlight
├─ Click "Devam →"
└─ Move to Step 4

STEP 4: CHORUS STYLE
├─ Click chorus card (3 options)
│  └─ onclick="selectChorus(this)"
├─ Visual feedback: Border highlight
├─ Click "Devam →"
└─ Move to Step 5

STEP 5: SONG GENERATION (CUSTOM MODE)
├─ Genre quick buttons: 🇹🇷 Türkçe Pop, 🎭 Arabesk, 💣 Trap, etc.
│  └─ onclick="selectGenreQuick(this)"
├─ Language selector: onclick="openLangModal()"
├─ Mood buttons: Happy, Sad, Aggressive, Romantic, Calm, Cool
│  └─ onclick="selectMood(this)" → loads preset prompts
├─ Optional: "✦ AI Söz Yazsın" (AI Lyrics Generator)
│  └─ onclick="generateAILyricsMain()" → ASYNC API call
└─ Click "✦ Şarkımı Oluştur →" button

   ⏱️ WIZARD TOTAL: ~2-3 sec (user input time, no API calls yet)
```

### PHASE 3: SONG GENERATION (CRITICAL PATH - LATENCY CHECK)

```
CLICK "✦ Şarkımı Oluştur →" BUTTON
│
├─ onclick="generateMusic()" triggered
│  └─ VISUAL FEEDBACK START
│     ├─ Button shows loading state (disable + spinner)
│     ├─ Modal/overlay appears (loading animation)
│     └─ User sees "Şarkı oluşturuluyor..." message
│
├─ BUILD PROMPT from wizard fields
│  ├─ emotion, power, lyrics, chorus, genres, mood
│  ├─ language (Turkish default)
│  └─ Combine into coherent prompt string
│
├─ PRE-GENERATION QUOTA CHECK
│  └─ Call: /api/auth { email, action: "check" }
│     ├─ Latency: ~300-500ms (Redis cached)
│     ├─ Response: { allowed: true/false, songs_used, songs_limit }
│     └─ If not allowed (songs_used >= 3):
│        ├─ Show Pro upgrade modal
│        ├─ "Ücretsiz limitin doldu. Pro'ya geç!"
│        └─ Button: "Pro'ya Geçerek Açın" → openPaywall()
│        └─ RETURN (stop generation)
│
├─ SEND TO kie.ai API
│  │
│  └─ Call: /api/generate { prompt, style, title, email, ... }
│     │
│     ├─ Vercel function processes
│     │  ├─ POST to kie.ai: https://api.kie.ai/api/v1/generate
│     │  │  ├─ Latency: ~2-5 SECONDS (kie.ai backend)
│     │  │  └─ Response: { success: true, taskId: "abc123xyz" }
│     │  │
│     │  ├─ QUOTA INCREMENT (AFTER SUCCESS)
│     │  │  └─ Call /api/auth { email, action: "use" }
│     │  │     ├─ Update Redis quota
│     │  │     └─ Async sync to Supabase
│     │  │
│     │  └─ Return taskId to client
│     │
│     └─ Client receives: { taskId: "abc123xyz" }
│
├─ POLL FOR COMPLETION
│  │
│  ├─ Start polling interval (~2 seconds)
│  ├─ Call: /api/status { taskId }
│  │  └─ Check kie.ai task status
│  │     ├─ Status: processing
│  │     ├─ Status: completed → { audioUrl: "..." }
│  │     └─ Latency: ~1 sec per check
│  │
│  └─ LOOP until complete
│     └─ Estimated wait: 30-120 seconds (kie.ai generates audio)
│
├─ SONG READY
│  ├─ Audio file generated at: kie.ai CDN
│  ├─ User hears: ▶ Dinle (Play button lights up)
│  ├─ User can: ⬇ İndir (Download)
│  └─ OPTIONAL: Generate AI video (fal.ai)
│
└─ UI UPDATES
   └─ Modal closes
   └─ Song appears in results section
   └─ User can play/download

   ⏱️ GENERATION TOTAL: 35-125 seconds
   ├─ Button press to kie.ai response: 2-5 sec
   ├─ kie.ai processing: 30-120 sec
   └─ Total: generation time depends on kie.ai backend
```

---

## 🎯 LATENCY BREAKDOWN

| Step | Component | Expected | Status |
|------|-----------|----------|--------|
| Email modal | localStorage check + /api/auth | <1.5s | ✅ OK |
| Wizard flow | User input (no API) | 2-3s | ✅ OK |
| Quota check | /api/auth action=check (Redis) | <0.5s | ✅ OK |
| kie.ai call | API POST | 2-5s | ⚠️ SLOW (external) |
| kie.ai generate | Backend processing | 30-120s | ⚠️ SLOW (external) |
| Polling | /api/status calls | 1s per call | ⚠️ SLOW (depends on kie.ai) |

---

## 🔴 CRITICAL LATENCY POINTS (IDENTIFY & FIX)

### POINT 1: BUTTON CLICK → VISUAL FEEDBACK
**Problem to test:** User clicks "✦ Şarkımı Oluştur →" - does loading spinner appear INSTANTLY (within 50ms)?

**Current implementation:**
```javascript
async function generateMusic() {
  // Line 1: Check quota
  // Line 2: Send to API
  // Line 3: Update UI
}
```

**Issue:** UI update might be delayed if API calls are slow. Should show loading FIRST.

**Fix needed:**
- Show loading spinner BEFORE any API call
- Disable button IMMEDIATELY (visual feedback)
- Then do async work

### POINT 2: API RESPONSE TIME
**Problem to test:** /api/generate takes how long?
- Quota check (should be <500ms)
- kie.ai POST (should be <5s)
- Total response (should be <6s)

### POINT 3: POLLING DELAYS
**Problem to test:** Song generation polling - check every 2 seconds or faster?

---

## 📊 ALL BUTTONS REQUIRING IMMEDIATE VISUAL FEEDBACK

| Button | Function | Feedback Type | Status |
|--------|----------|---|---|
| ▶ Örnek Dinle | playDemo() | Play animation | 🔴 TEST |
| 💔 Hüzün (emotion) | selectEmotion() | Highlight + color | 🔴 TEST |
| ⚡ Güç (power) | selectPower() | Border glow | 🔴 TEST |
| Novahit/Ben (toggle) | setLyrics() | Button highlight | 🔴 TEST |
| Devam → (step nav) | nextStep() | Quick transition | 🔴 TEST |
| ✦ Şarkımı Oluştur → | generateMusic() | Spinner + disable | 🔴 TEST |
| Pro'ya Geçerek Açın | openPaywall() | Modal open | 🔴 TEST |
| ▶ Dinle (results) | playAudio() | Player opens | 🔴 TEST |
| ⬇ İndir | downloadSong() | File download | 🔴 TEST |

---

## ✅ AUDIT CHECKLIST

**Before Production Deploy:**
- [ ] Email modal: <1s end-to-end
- [ ] Wizard step transitions: instant (<100ms visual response)
- [ ] Quota check: <500ms (Redis cached)
- [ ] Button click feedback: <50ms
- [ ] Loading animation: starts immediately
- [ ] kie.ai API: 2-5s response time
- [ ] Song generation: 30-120s (acceptable, external service)
- [ ] Polling: smooth, no stalling
- [ ] Pro modal: appears immediately on quota exceeded
- [ ] All click events: no lag, no flicker
- [ ] Mobile: responsive on iPhone/Android
- [ ] Error handling: user sees error messages, not blank screen
- [ ] No console errors (F12 check)

---

**OUTPUT:** Run latency tests on all 10+ buttons. Report any >500ms delays. Fix before production.
