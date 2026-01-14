# Feedback Screenshots & Chat Fixes - Implementation Plan

## 1. Screenshot Upload for Corrections/Comments

### Current State
- ✅ Database supports it (`attachments Json?` on PatternCorrection and PatternComment)
- ❌ UI doesn't let users upload files
- ❌ No API endpoint for session file uploads

### Implementation Needed

#### A. Create Session File Upload API
**File:** `/web/src/app/api/sessions/upload/route.ts`
- Reuse R2 upload pattern from `/api/chat/upload`
- Store in path: `session-attachments/{userId}/{filename}`
- Return attachment metadata for inclusion in corrections/comments

#### B. Add FileUpload to Correction Form
**File:** `/web/src/components/sessions/CorrectionForm.tsx` (or wherever corrections are created)
- Import FileUpload component
- Add file state management
- Include attachment IDs in correction submission
- Display uploaded files before submission

#### C. Add FileUpload to Comment Form
**Similar to corrections**
- Add to comment creation UI
- Store attachment metadata in comment

#### D. Display Attachments in Corrections/Comments
**Files:** Wherever corrections/comments are displayed
- Show attached images inline
- Show download links for other files
- Add lightbox for image viewing

---

## 2. Export Screenshots with Prompt

### Current State
- ✅ Prompt includes attachment URLs
- ❌ JSON download doesn't include actual files
- ❌ Admin has to manually click each URL

### Implementation Needed

#### Update Export Prompt API
**File:** `/web/src/app/api/sessions/[id]/export-prompt/route.ts`

**New Approach:**
1. Collect all attachment URLs from corrections and comments
2. Download each file from R2
3. Create a ZIP file containing:
   - `prompt.md` - The formatted prompt
   - `session-data.json` - The session JSON
   - `screenshots/` directory with all images
   - `attachments/` directory with other files
4. Return ZIP file for download

**Required:**
- Install `archiver` or `jszip` package
- Add file download from R2
- Stream ZIP creation

**Alternative (Simpler):**
- Keep JSON download as-is
- Add button "Download All Screenshots" that fetches and zips just images
- Prompt reminds admin to download screenshots separately

---

## 3. Chat Voice Feature Fix

### Current State
- ❌ Voice recording doesn't work
- Need to investigate: Is it not implemented, or broken?

### Investigation Needed
**File:** `/web/src/app/chat/page.tsx`
- Find voice recording UI/button
- Check if MediaRecorder API is used
- Check browser permissions
- Test on different browsers

**Likely Issues:**
- MediaRecorder not initialized
- Permissions not requested properly
- Upload endpoint missing
- Audio format incompatibility

### Fix Approach
1. Find voice recording code
2. Debug MediaRecorder setup
3. Ensure proper permission handling
4. Test recording → upload → playback flow

---

## 4. Chat Emoji Picker Fix

### Current State
- ❌ Emoji picker doesn't work
- Need to investigate: Not implemented or broken?

### Investigation Needed
**File:** `/web/src/app/chat/page.tsx`
- Find emoji picker button
- Check if emoji picker library is imported
- Check for console errors

**Likely Issues:**
- Library not installed (emoji-picker-react, etc.)
- Import missing
- Event handlers not connected
- CSS conflicts

### Fix Approach
1. Check if emoji library is in package.json
2. Install if missing: `npm install emoji-picker-react`
3. Import and add to chat input
4. Connect picker selection to message input

---

## Priority Order

1. **Session File Upload API** (Required for everything else)
2. **Add FileUpload to Correction/Comment Forms** (User-facing, immediate value)
3. **Display Attachments** (Show uploaded files)
4. **Export Screenshots** (Admin workflow improvement)
5. **Chat Emoji Fix** (Quick win if just missing library)
6. **Chat Voice Fix** (More complex, investigate first)

---

## Quick Wins vs Complex Work

### Quick (Can do now):
- Session upload API (copy from chat upload)
- Add FileUpload component to forms
- Display attachments
- Fix emoji picker (if just missing library)

### Complex (Needs more time):
- ZIP file generation for export
- Voice recording debugging
- Proper lightbox/gallery for images

---

## Recommended Immediate Action

Start with #1 and #2 - get screenshots working for corrections/comments. The upload infrastructure exists, just needs to be connected. This gives immediate value to users providing feedback.

Export improvements (#4) can come after, once there's actual content to export.

Chat fixes (#5, #6) are separate features and can be done independently.
