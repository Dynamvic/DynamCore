# DynamCore v2.0 (sw dynamcore-v12) – 19-11-2026

## Change log (English, for the coach)

| # | Change | Files | Behaviour change |
|---|---|---|---|
| 1 | **Weeks that have started are frozen.** Past weeks keep their sessions; in the current week the days before today (and sessions already done) are kept, the remaining days follow the new settings. Week overrides (skip, move, recovery toggle, travel, group off/focus) still work on frozen weeks. Session *contents* (exercises) of past weeks still follow level/equipment, as before. | engine.js, app.js | Yes |
| 2 | **Pauses are stored as periods** (`P.pauses`). The start date no longer moves; calendar weeks completely inside a pause get no plan week number; paused days show "Gepauzeerd" and do not count as missed or break the streak. Athletes who already resumed with v1.9 keep their shifted history (cannot be reconstructed). | engine.js, app.js, group.js | Yes |
| 2b | **Start date locked** in Settings once sessions are logged and the plan has started (all history is stored per plan week). Before that it stays editable. | app.js, i18n.js | Yes |
| 3 | **coach.html:** pasted `#DC1.` codes are cleaned (known fields only, numbers forced, name max. 40 characters) and everything is escaped. Old stored entries are cleaned on load. | coach.html | No |
| 4 | Changing the **date** of a completed session now moves the app-created activity in Intervals.icu. Watch activities keep their own date (decision 19-11-2026). | done.js | Yes (matches decision 7) |
| 5 | **Restore** checks the file: no valid start date → refused, nothing changed; other missing/invalid fields get the default value (count shown); invalid logs dropped. Asks before replacing existing data; previous data kept aside with a "Vorige gegevens terugzetten" button. A back-up without key keeps the key already on the phone. | app.js, i18n.js | Yes (confirmation step) |
| 6 | **Back-up asks each time** whether to include the Intervals.icu key (default/first choice: without). Back-up format v: 2. | app.js, i18n.js | Yes |
| 7 | **Fonts self-hosted** (Poppins 600/700/800 from your upload, Inter 400/500/600; Latin subset, WOFF, SIL OFL licences in fonts/). No requests to Google any more. | index.html, coach.html, sw.js, fonts/ | No (looks the same) |
| 9 | Race week that is also a recovery week: counts as recovery week in the cycle, label "Telt als herstelweek", sessions follow race-week rules only (no extra recovery reduction). | engine.js, app.js, i18n.js | Yes |
| 10 | First back-up reminder 30 days after the first logged session (was: right after it). | app.js | Yes |
| 13 | Load per hour editable for Activation (36/h) and Post-ride recovery (20/h) too. Default values unchanged. | app.js | Yes (Settings) |
| 14 | Phase override also offers Taper and Wedstrijdweek. | app.js | Yes (Settings) |
| 22 | Challenge/share "minutes" use the actual duration (older logs without one: planned, group 60). | group.js | Yes |
| Q10 | "Sessie gedaan" sheet closes after Bewaar; the result (and Intervals.icu result) appears at the bottom of the screen. | done.js | Yes |
| – | Migration v2.0 (runs once, also after restore): `P.pauses = []`, `S.weekSnap` created, all started weeks frozen as they look now. | app.js | – |
| – | VERSION 2.0 (app.js), dynamcore-v12 (sw.js). Access lock still parked (ACCESS_ENABLED = false). | | – |

Not changed: RPE scale, load defaults, level thresholds, planning rules, exercise codes.

## Wijzigingen voor de atleten (Nederlands, om te delen)

**DynamCore 2.0 – wat is er nieuw?**
- Je oude weken blijven zoals ze waren, ook als je instellingen aanpast. Wijzigingen gelden vanaf vandaag.
- Pauzeren (ziekte, vakantie) bewaart je geschiedenis: na het hervatten ga je verder met de volgende week. Gepauzeerde dagen tellen niet als gemist en breken je reeks niet.
- De startdatum ligt vast zodra je sessies afgevinkt hebt. Even niet trainen? Gebruik "Pauzeer plan".
- Na "Bewaar" sluit het venster vanzelf; onderaan zie je of het gelukt is (ook voor Intervals.icu).
- Datum van een sessie aangepast? Dan schuift de activiteit in Intervals.icu mee.
- Bij een back-up vraagt de app of je Intervals.icu-sleutel mee mag. Kies "Zonder sleutel" als je de back-up naar iemand stuurt.
- Back-up terugzetten vraagt eerst bevestiging. Fout gedaan? In Instellingen kan je je vorige gegevens terugzetten.
- De eerste back-up-herinnering komt pas 30 dagen na je eerste sessie.
- Groepsuitdaging "minuten" telt nu je echte duur.
- Wedstrijdweek die samenvalt met een herstelweek: je ziet "Telt als herstelweek" en traint volgens het wedstrijdschema.
- De app laadt geen lettertypes meer van Google: niets verlaat je telefoon.

Na de update verschijnt bovenaan "Er is een nieuwe versie van DynamCore" → tik op **Nu laden**.

## Upload checklist (GitHub, same repository and address)
1. Ask athletes for a back-up first (Instellingen → Back-up bewaren als bestand) – this is a bigger update.
2. Optional (update rules): upload to a test repository first (e.g. dynamcore-test) and do the phone test there.
3. In the repository: **Add file → Upload files**. Drag in the changed files: `app.js`, `done.js`, `engine.js`, `group.js`, `i18n.js`, `index.html`, `coach.html`, `sw.js`.
4. Upload the new folder **`fonts/`** with all 8 files (6 × .woff, OFL-Poppins.txt, OFL-Inter.txt). Easiest: drag the whole `fonts` folder into the upload window.
5. Do NOT replace `key.js` or `access.js` (unchanged; lock stays off). `done.js` is part of this update anyway.
6. Commit message e.g. "DynamCore v2.0". Wait 1–2 min for GitHub Pages to publish.
7. Check in a browser: `…/dynamcore/sw.js` shows `dynamcore-v12`; `…/dynamcore/fonts/poppins-700.woff` downloads.
8. Open the app on your phone → banner "Nu laden" → tap → Settings → About shows "Versie 2.0".
9. Optional: the old Winterkern repository on the same address can be deleted (it is obsolete).
