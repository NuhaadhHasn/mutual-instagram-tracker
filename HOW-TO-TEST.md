# Complete Testing & Debugging Guide

## 📱 BEST IDE FOR THIS PROJECT

From your screenshot, **USE VISUAL STUDIO CODE** ⭐

### Why VS Code?
- ✅ Best React Native support
- ✅ Excellent extensions ecosystem
- ✅ Fast and lightweight
- ✅ Free and open source
- ✅ Built-in terminal
- ✅ Git integration

### Install VS Code Extensions:
```
1. React Native Tools
2. ES7+ React/Redux/React-Native snippets
3. Prettier - Code formatter
4. ESLint
5. Expo Tools
6. TypeScript and JavaScript Language Features
```

**Alternative:** WebStorm (also good, but paid)

---

## 🚀 HOW TO START TESTING

### Step 1: Open in VS Code

```bash
# Open VS Code in project folder
cd "C:\Users\nuhaa\instagram Followers\instagram-tracker"
code .
```

### Step 2: Open Integrated Terminal

In VS Code:
- Press `Ctrl + ` (backtick) to open terminal
- Or: View → Terminal

### Step 3: Start Expo

```bash
npx expo start
```

### Step 4: Choose How to Run

**Option A: Physical Phone (EASIEST) ⭐**
```
1. Install "Expo Go" app from Play Store (Android) or App Store (iOS)
2. Scan QR code from terminal with Expo Go
3. App loads on your phone
```

**Option B: Android Emulator**
```
Press 'a' in terminal

If you don't have emulator:
1. Download Android Studio
2. Open AVD Manager
3. Create virtual device
4. Start emulator
5. Then press 'a' in Expo terminal
```

**Option C: iOS Simulator (Mac only)**
```
Press 'i' in terminal
```

---

## 🧪 TESTING CHECKLIST

### Test 1: App Launch ✅
```
Expected: App opens and shows Import screen
If fails: See "Common Errors" below
```

### Test 2: Import Your Data 📦
```
1. Tap "Import Instagram Data"
2. Select your ZIP file:
   C:\Users\nuhaa\instagram Followers\instagram-nuhaadh.h-2025-11-28-lhiLd2mg.zip

Expected Result:
- Progress indicator shows
- Success alert appears
- Shows: 1770 following, 949 followers, 980 unfollowers
- Navigates to Dashboard

If fails: Check "Debugging File Import" below
```

### Test 3: Dashboard 📊
```
Check:
- Stats cards show correct numbers
- Follow-back ratio calculated correctly
- Recent unfollowers list visible
- All cards clickable

Expected:
- Followers: 949
- Following: 1770
- Unfollowers: 980
- Mutual: 790
```

### Test 4: Unfollowers Screen 👥
```
1. Tap "Unfollowers" tab
2. See list of 980 users
3. Search for a username
4. Try sorting (A-Z vs Date)
5. Tap on a user

Expected:
- List scrolls smoothly
- Search filters correctly
- Sort works
- Tapping opens Instagram profile
```

### Test 5: Settings ⚙️
```
1. Tap "Settings" tab
2. Tap "Clear All Data"
3. Confirm deletion
4. App navigates to Import screen

Expected:
- Data cleared
- Fresh start
```

---

## 🐛 COMMON ERRORS & FIXES

### Error 1: "Cannot read property 'string_list_data'"

**Cause:** ZIP file structure different than expected

**Fix:**
```typescript
// Add better error handling
// Edit: src/services/parsers/instagramParser.ts

private processData(followersRaw: any, followingRaw: any): FollowerData {
  // Add validation
  if (!Array.isArray(followersRaw)) {
    throw new Error('Invalid followers data format');
  }

  if (!followingRaw?.relationships_following) {
    throw new Error('Invalid following data format');
  }

  // Rest of code...
}
```

### Error 2: "Module not found: Can't resolve..."

**Cause:** Missing dependency

**Fix:**
```bash
cd instagram-tracker
rm -rf node_modules
npm install
npx expo start -c
```

### Error 3: "Unable to resolve module"

**Cause:** Metro bundler cache issue

**Fix:**
```bash
npx expo start -c
# -c flag clears cache
```

### Error 4: File picker doesn't open

**Cause:** Missing permissions (Android)

**Fix:**
```typescript
// Add to app.json
{
  "expo": {
    "android": {
      "permissions": [
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

### Error 5: App crashes on data import

**Cause:** Large file size or memory issue

**Fix:**
```typescript
// Add file size validation
// In ImportScreen.tsx

const handleImportData = async () => {
  // Add this before parsing
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (fileSize > maxSize) {
    Alert.alert('File too large', 'Please use a smaller export');
    return;
  }

  // Continue with parsing...
};
```

---

## 🔍 HOW TO DEBUG

### Method 1: Console Logs (Easiest)

**In VS Code:**
1. Open file you want to debug
2. Add console.log statements:

```typescript
// Example in ImportScreen.tsx
const handleImportData = async () => {
  console.log('1. Starting import...');

  try {
    const data = await instagramParser.pickAndParseZip();
    console.log('2. Data parsed:', data.stats);

    await dataStore.saveFollowerData(data);
    console.log('3. Data saved');

  } catch (error) {
    console.error('ERROR:', error);
  }
};
```

**View logs:**
- In VS Code terminal
- Or in Expo Go app: Shake phone → View logs

### Method 2: React DevTools

```bash
# Install
npm install -g react-devtools

# Run
react-devtools

# Then shake phone → Open React DevTools
```

### Method 3: VS Code Debugger

1. Install "React Native Tools" extension
2. Press F5 or Run → Start Debugging
3. Set breakpoints by clicking left of line numbers
4. App pauses at breakpoints

### Method 4: Expo DevTools

```bash
npx expo start

# Opens in browser
# Shows:
- Logs
- Performance
- Network requests
```

---

## 🛠️ HOW TO FIX BUGS

### Process:

**1. Identify the bug**
```
- What action causes it?
- What error message?
- When does it happen?
```

**2. Find the code**
```
Error message usually shows:
  at ImportScreen.tsx:45

→ Open that file and line
```

**3. Add debug logs**
```typescript
console.log('Before import');
console.log('Data:', JSON.stringify(data, null, 2));
console.log('After import');
```

**4. Test the fix**
```bash
# Save file
# App auto-reloads
# Test again
```

**5. If still broken, ask me!**
```
Tell me:
1. What you did
2. What error appeared
3. Screenshot if possible

I'll fix it immediately!
```

---

## 📸 COMMON TESTING SCENARIOS

### Scenario 1: First Time User
```
1. User opens app
2. Sees Import screen
3. Taps "How to export data"
4. Downloads Instagram data
5. Imports ZIP file
6. Sees Dashboard
7. Explores unfollowers
```

### Scenario 2: Returning User
```
1. User opens app
2. Sees Dashboard (data persisted)
3. Views analytics
4. Updates data with new import
```

### Scenario 3: Power User
```
1. Search for specific users
2. Sort unfollowers
3. Open multiple profiles
4. Clear and re-import data
5. Check settings
```

---

## ⚡ PERFORMANCE TESTING

### Test with Large Dataset:
```typescript
// Your data is perfect for testing:
- 1770 following
- 949 followers
- 980 unfollowers

This is a good medium-size dataset.
```

### What to check:
- [ ] List scrolls smoothly (60fps)
- [ ] Search is instant
- [ ] No lag when switching tabs
- [ ] Import completes in < 10 seconds

### If slow:
```typescript
// Add virtualized list
import { FlashList } from '@shopify/flash-list';

// Replace FlatList with FlashList in UnfollowersScreen.tsx
```

---

## 📊 TESTING WITH REAL DATA

### Use Your Actual Instagram Export:

**File location:**
```
C:\Users\nuhaa\instagram Followers\instagram-nuhaadh.h-2025-11-28-lhiLd2mg.zip
```

**Expected results:**
- Followers: 949
- Following: 1770
- Unfollowers: 980 (55.4%)
- Mutual follows: 790 (44.6%)

**Verify accuracy:**
1. Count matches your actual Instagram
2. Unfollowers list makes sense
3. No duplicate entries
4. All usernames valid

---

## 🎯 QUICK TEST SCRIPT

Copy-paste this into VS Code terminal:

```bash
# 1. Clean start
cd instagram-tracker
npx expo start -c

# 2. Run on phone (scan QR)
# OR press 'a' for Android emulator

# 3. Test steps:
# - Import data
# - View dashboard
# - Search unfollowers
# - Open a profile
# - Clear data
# - Re-import

# 4. Check console for errors
```

---

## 🆘 STILL STUCK?

### Quick Fixes:

**Problem: App won't start**
```bash
npx expo doctor
npx expo start -c
```

**Problem: Import fails**
```
- Check ZIP file is Instagram export
- Check file not corrupted
- Try smaller file first
```

**Problem: Blank screen**
```
- Check console for errors
- Try restarting Expo
- Clear cache: npx expo start -c
```

**Problem: Can't see logs**
```
- In Expo Go: Shake phone → Enable logs
- In terminal: Shows automatically
- In VS Code: Check Debug Console
```

---

## ✅ SUCCESS CRITERIA

You'll know it works when:

1. ✅ App launches without crashing
2. ✅ Import screen appears
3. ✅ File picker opens
4. ✅ ZIP file processes successfully
5. ✅ Dashboard shows correct stats
6. ✅ Unfollowers list displays all 980 users
7. ✅ Search works
8. ✅ Profile links open Instagram
9. ✅ Data persists after closing app
10. ✅ No console errors

---

## 📞 GET HELP

If anything doesn't work:

1. **Check console** for error messages
2. **Take screenshot** of error
3. **Tell me**:
   - What you did
   - What happened
   - Error message

I'll fix it IMMEDIATELY! 🚀

---

## 🎉 AFTER SUCCESSFUL TESTING

Once everything works:

1. **Create GitHub repo**
2. **Push code**
3. **Build APK**: `eas build -p android`
4. **Share with friends**
5. **Get feedback**
6. **Add improvements**

Good luck testing! 🎊
