# CRITICAL FIXES - BATCH 1

**Date:** 2026-03-22 17:30 UTC
**Status:** 🔴 IN PROGRESS

---

## ISSUES TO FIX

### ISSUE #1: AI Sözler - Input/Output Mismatch ❌

**Problem:** User selects "Arabesk + Romantik" but AI writes random hardcoded lyrics like "Alevler İçinde"

**Location:** index.html line 3122-3139 (generateAILyricsMain)

**Current Code:**
```javascript
function generateAILyricsMain() {
  var samples = [
    "Geceleri uyuyamam...",  // Random sample 1
    "Yüksel gökyüzüne...",   // Random sample 2
    "Kahvenin kokusu..."     // Random sample 3
  ];
  var chosen = samples[Math.floor(Math.random() * samples.length)];
  // Ignores mood, genre, emotion selection!
}
```

**Fix:** AI lyrics must respect user selections (emotion, mood, genre)
- Read selected emotion from wizardState
- Read selected mood/genre from UI
- Generate lyrics matching selection
- Log parameters to verify match

---

### ISSUE #2: V1-V2-V3 Locks - localStorage vs Server Mismatch ❌

**Problem:** First user only sees V1, but V2/V3 should be visible for first user

**Location:** index.html line 3212-3248 (applyVersionLocks)

**Current Logic:**
```javascript
var used = parseInt(localStorage.getItem('novahit_songs_used') || '0');
// Uses CLIENT-SIDE counter, not SERVER quota!
if (used > 3) {
  // Lock V2/V3
}
```

**Issue:** localStorage counter is separate from server Redis quota. First user might have 0 in localStorage even though server knows they used songs.

**Fix:** Use server quota data instead:
- After song generation, fetch server quota via `/api/auth?action=check`
- Use server's `songs_used` to determine locks
- Lock ONLY after songs_used >= 3

---

### ISSUE #3: Vokal Seçimi Karışık ❌

**Problem:** "Erkek / Kadın / Koro" not clearly labeled, no "Vocal Type" header

**Location:** Unknown - need to find voice selection UI

**Fix:** Add clear structure:
```html
<div class="studio-block">
  <div class="studio-block-title">🎤 Vokal Tipi</div>
  <div class="voice-grid">
    <button data-voice="male">🧑 Erkek Sesi</button>
    <button data-voice="female">👩 Kadın Sesi</button>
    <button data-voice="choir">👥 Koro</button>
  </div>
</div>
```

---

### ISSUE #4: 5 Dakika Bekleme (Timeout) ❌

**Problem:** Song takes 5+ min, user sees nothing, thinks it's stuck

**Current:** Spinner shows "Şarkı oluşturuluyor..." but no progress update

**Fix:** Add smart timeout handling:
1. Show timer: "00:47 / ~120 saniye"
2. Every 15 sec: "Hala çalışıyor... biraz sabır"
3. At 3 min: "Biraz daha... yüksek kalite işleme sürüyor"
4. At 5 min: "Sunucu meşgul, bu normaldir. Bekleyin..."
5. At 8 min: If still nothing, show error + retry button

---

### ISSUE #5: Panel Otoscroll ❌

**Problem:** Site scrolls up on its own during generation

**Location:** Likely in showKlipStudio() or result display

**Fix:** Don't auto-scroll, let user stay where they are
- Remove scrollIntoView calls
- Keep loading spinner in viewport
- User can scroll if they want

---

## FIX PRIORITY

1. **CRITICAL (User can't use site properly):**
   - ISSUE #2: V2/V3 visibility (breaks user experience)
   - ISSUE #4: Timeout handling (looks like site is broken)

2. **HIGH (Confuses user):**
   - ISSUE #1: AI lyrics matching
   - ISSUE #3: Voice selection clarity

3. **MEDIUM (Annoying but works):**
   - ISSUE #5: Autoscroll

---

## IMPLEMENTATION PLAN

```
Step 1: Fix V1-V2-V3 logic (use server quota, not localStorage)
Step 2: Fix AI lyrics (respect user selections)
Step 3: Add timeout handler (show progress + messages)
Step 4: Improve voice UI (clear labels)
Step 5: Remove autoscroll
Step 6: Test all changes
Step 7: Deploy
```

---

## TEST AFTER FIX

```
[ ] Create song as FIRST user
    → V2 and V3 should be VISIBLE and unlocked

[ ] Select "Arabesk" + "Hüzünlü"
    → Click "AI Söz Yazsın"
    → Should generate lyrics matching Arabesk theme
    → NOT random "Alevler İçinde"

[ ] Watch timeout:
    → 0-1 min: "Melodi yazılıyor..."
    → 1-2 min: "Akorlar ayarlanıyor..."
    → 2-3 min: "Mix & mastering..."
    → 3+ min: Progress timer "03:45 / ~120 saniye"

[ ] Voice selection:
    → Clear labels: "🧑 Erkek Sesi", "👩 Kadın Sesi", "👥 Koro"
    → Not confusing "Erkek/Kadın/Koro" list

[ ] Scroll:
    → Panel doesn't jump up
    → User can watch generation in place
```

---

**Next:** Start fixing CRITICAL issues immediately.
