# PHASE 2.A — GÜVENLİK TESTI PROTOKOLÜ

**Tarih:** 2026-03-22
**Test Amacı:** Email giriş sistemi + Supabase bağlantı + localStorage persistence
**Site:** https://novahitmusic.vercel.app/

---

## 🔴 ÖN KONTROL — SITEYE ERİŞ

1. **Tarayıcıda aç:** https://novahitmusic.vercel.app/
2. **Beklenti:** index.html açılmalı (maintenance.html DEĞİL)
3. **Hata varsa:**
   - F12 → Console tab
   - Hangi hata? (screenshot çek)
   - Vercel deployment log kontrol et

**✓ Başarılı:** Sayfa yüklendiyse devam et

---

## TEST 1: EMAIL MODAL AÇILMIŞ MI?

**Senario:** Kullanıcı ilk kez "Şarkı Üret" butonuna basıyor

**Adımlar:**
1. Sayfayı aç
2. "Şarkı Üret" butonunu ara (büyük turuncu buton)
3. Tıkla
4. **Beklenti:** Email modal açılmalı
   - Modal başlığı: "Şarkını Kaydet"
   - Input: "ornek@mail.com" placeholder
   - Button: "Devam Et →"

**✓ PASS:** Modal göründüyse TEST 1 geçti
**✗ FAIL:** Modal açılmadıysa
   - Console error screenshot
   - Network tab screenshot
   - Hata rapor et

---

## TEST 2: EMAIL INPUTA YAZ VE KAYDET

**Senario:** Email girip modal kapatıyor

**Adımlar:**
1. Modal açık halde email input'u tıkla
2. Email yaz: `test@example.com`
3. "Devam Et →" butonuna tıkla
4. Modal kapanmalı

**Beklenti:** Şarkı üretim wizard başlamalı (mood seçimi, vs)

**Console'da kontrol et (F12 → Console):**
```javascript
window.localStorage.getItem('novahit_email')
```

**Beklenen sonuç:**
```
"test@example.com"
```

**✓ PASS:** Email localStorage'da var
**✗ FAIL:**
   - `null` dönerse input hatası var
   - Error varsa screenshot çek

---

## TEST 3: SUPABASE - EMAIL KAYDEDILDI Mİ?

**Senario:** Email verisi Supabase'e yazıldı mı?

**Supabase kontrol (Sen'in hesapdan):**
1. https://supabase.com → Projene git
2. "quotas" tablosunu aç
3. Email sütununda `test@example.com` araştır

**Bekleni:**
| email | songs_used | songs_limit | plan |
|-------|-----------|------------|------|
| test@example.com | 0 | 3 | free |

**✓ PASS:** Tablo'da var, değerler doğru
**✗ FAIL:**
   - Email yok: Supabase bağlantı hatası (API key kontrol et)
   - songs_limit null: Default 3 değeri kullanılması gerek
   - Hata rapor et

---

## TEST 4: SITENIN AÇILMASI SONRASI RELOAD

**Senario:** Email localStorage'da kalıyor mu?

**Adımlar:**
1. Email modal'ı kapattıktan sonra (TEST 2 tamamlandıktan)
2. Sayfayı yenile (F5)
3. Email modal tekrar açılmamalı (çünkü email zaten localStorage'da)
4. Console'da kontrol et:
```javascript
window.localStorage.getItem('novahit_email')
```

**Beklenti:** Hala `"test@example.com"` görmeli

**✓ PASS:** Email persist ediyorsa localStorage çalışıyor
**✗ FAIL:**
   - `null` dönerse localStorage not working
   - Modal tekrar açılıyorsa logic hatası

---

## TEST 5: MOBİLE RESPONSIVE CHECK

**Senario:** Telefonda göründüğü gibi mi?

**Chrome DevTools kullan:**
1. F12 → Device Toolbar toggle (Ctrl+Shift+M)
2. Device: iPhone 12 seç
3. Email modal açılıyor mu? Erişilebilir mi?
4. Input ve button tap ediliyor mu?

**Beklenti:**
- Modal tam görünmeli
- Input erişilebilir
- Button tıklanabilir

**✓ PASS:** Mobile friendly
**✗ FAIL:**
   - Modal kırılmış? Screenshot
   - Input erişilemiyor? Screenshot

---

## 📋 PHASE 2.A CHECKLIST

- [ ] Site açılıyor (index.html yüklendğ)
- [ ] Email modal çıkıyor
- [ ] Email input'a yazılabiliyor
- [ ] localStorage'a kaydediliyor
- [ ] Supabase'e yazılıyor
- [ ] Reload sonrası persist ediyor
- [ ] Mobile'da çalışıyor
- [ ] Console error yok

---

## ❌ FAIL DURUMUNDA

**Adım 1:** Screenshot al
- Sayfa screenshot
- Console hataları
- Network tab (F12 → Network → /api/auth request)

**Adım 2:** Hata rapor et
```
Hangi test başarısız?
Hata mesajı:
Screenshot/log:
```

**Adım 3:** İnceleme
- /api/auth.js kontrol edilecek
- Supabase environment variable kontrol
- Email validation logic check

---

## ✅ PASS DURUMUNDA

**Tamamlandı!** EMAIL & SUPABASE SİSTEMİ ÇALIŞIYOR ✓

Sonraki:
```
PHASE 2.B — KOTA SİSTEMİ TEST
(3 şarkı hediyesi + Pro kilidi)
```

---

## NOTLAR

- Test email: `test@example.com` (istersen değiştir, ama Supabase'de kontrol et)
- localStorage key: `novahit_email`
- Default quota: 3 free songs
- Supabase table: `quotas`

---

**Test başla! Sonuçları rapor et.**
