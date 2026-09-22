# iHotel AV Scheduler

One page for the AV team's week at Hotel Illinois Conference Center: events, staff, equipment inventory and audits, schedule options, room signs, PowerPoint export and PDF import. It runs in the browser, so it hosts on GitHub Pages like the iHotel messaging app. Optional cloud sync keeps your data available on every device.

## Put it online (GitHub Pages)

1. Create a new repository on GitHub (for example `iHotel-scheduler`).
2. Upload everything in this folder, keeping the `css/` and `js/` folders. On github.com use **Add file, Upload files** and drag the contents in.
3. In the repository go to **Settings, Pages**. Under **Build and deployment** choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the app is at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

Notes
- GitHub Pages sites are public. Nothing you type goes to GitHub: your data lives in your browser, and, only if you turn on cloud sync, in your own Firebase database (see Cloud sync).
- Private repositories need a paid GitHub plan to use Pages.
- The app loads a few things from the internet on demand: Montserrat and Ovo fonts, your logo from the messaging repository, and, only when used, PDF.js and the text reader (PDF import), PptxGenJS (PowerPoint), JSZip (ZIP of signs) and ExcelJS (Excel files for inventory and audits). Cloud sync loads the Firebase web library only after you sign in.

## First run

1. **Equipment**: replace the placeholder counts with what you own. *Import* takes an Excel or CSV file, or a pasted list, so you can add everything at once. Set which items can be rented and roughly what a rental costs per day.
2. **Rooms**: check each room's standard AV kit. Mark items as *installed* if they're permanently in the room, so they don't count against inventory.
3. **Staff**: add people with weekly minimum and maximum hours, the days and times they prefer, and any days off.
4. **Events**: type them in, or import an event-sheet PDF and review the drafts.
5. **Schedule**: press *Build options*, compare, preview and use one. Click a shift to edit, lock or delete it, or drag it to someone else on the same day.

In each event, **In-room tech** lets you ask for techs for the whole event, or tick *Only at certain times* and list the times you need them (for example 9:00 to 10:00 with one tech, 1:00 to 3:30 with two).

*Settings, Your data, Load sample week* fills everything with demo data so you can try it first.

## How scheduling works

Each event that needs AV creates staff needs from the event hours plus your before and after buffers.

- One *room coverage* person owns the rooms for the day (overlapping or nearby events share one person; long days are split at the longest-shift limit).
- Each in-room tech seat on an event adds one extra *tech* shift, for the whole event or just the times you listed (your before and after buffers are added around each time). Tech billing counts the hours you list, with the minimum applied per tech.
- Short needs are padded to the shortest-shift setting.

Hard rules that every option follows: weekday availability, days off, tech eligibility, no overlaps, minimum rest between shifts, daily maximum, weekly maximum. Soft goals that differ by option: hitting weekly minimums, staying inside preferred hours, sharing hours evenly, fewest people, keeping one person on the same event, avoiding overtime. If someone can't be found for a shift it stays *open* and is listed as a problem.

All numbers are in **Settings**.

## PDF import

*Events, Import PDF* reads the real text on Notes pages (room, date, setup, AV items, in-room tech) and runs text recognition on floor-plan pages, which have no text layer, to find the agenda times and tech counts. Everything comes in as a draft table you fix before adding. Imported events with something worth checking show a **Review** badge. Recognition takes roughly a second or two per page on a modern laptop after a one-time download.

## Room signs and PowerPoint

- **Room signs** makes 1920x1080 PNGs (event name centered, room name along the bottom). *Classic gray* matches the example sign; *iHotel blue and orange* is the brand version; *Hotel Illinois (U of I)* adds the Hotel Illinois Conference Center logo across the top. Download one, or tick several for a ZIP.
- **PowerPoint** exports one or more weeks: staff schedule grid, event list with staffing, equipment check, and optionally one sign per event. Signs can be editable text (uses the Montserrat font; install it on the computer that opens the deck) or exact pictures.

## Equipment, inventory and audits

**Equipment** has three tabs.

- **Inventory**: every item with category, make/model, asset tag, serial, location, how many you own, how many are out of service, condition, value and rental rate. Own and Out edit right in the table. Only units that are not out of service count when the app checks an event's needs. *Export Excel* downloads the whole list.
- **Week forecast**: the shortage and rental list for the week.
- **Audits**: *Start audit* lists every item that isn't retired, in walking order by location. Count on screen (the check button means "matches"), or use Excel or paper:
  - *Blank fillable sheet* is an Excel form. Only the yellow cells can be edited, Condition is a dropdown, and Variance calculates itself. Fill it in and use *Import filled Excel* inside the audit to bring the counts back.
  - *Print* makes a paper sheet grouped by location, with checkboxes and a signature line.
  - *Finish audit* can update your inventory to the counts and add anything you found that wasn't listed. The monthly sheet (Excel) then has a summary, the audit sheet, extras and a discrepancies tab.

## Search and filters

Search, room buttons and a day picker sit above This week, Events, Schedule and Room signs. They combine (for example Chancellor Ballroom on Thursday) and stay on when you move between those screens. *Clear* resets them.

## Cloud sync (optional)

Cloud sync keeps a copy of everything in a Firebase Realtime Database so you can open the app on any computer, tablet or phone. Each browser still keeps its own copy, so the app works offline and catches up when you reconnect. Changes to different items on two devices merge automatically. If the very same item is edited on two devices at once, the cloud's version is kept and you're told.

One-time setup, in the Firebase console for your project (the app is pre-set to the same project as the iHotel messaging app; to use another project, put its web keys in `js/cloud-config.js`):

1. **Authentication, Sign-in method**: turn on **Email/Password**.
2. **Realtime Database, Rules**: add the two blocks from `firebase-rules.json` inside your existing `"rules"` object (don't replace the rules your messaging app uses), then **Publish**.
3. In the app: **Settings, Cloud sync**, enter an email and password, press **Create account**.
4. The app shows an account ID and says it needs approval. In **Realtime Database, Data**, add a top-level child `avSchedulerAllowed`, and inside it a child named with that ID and the value `true`. Back in the app press **Check again**. Repeat for each person or device account you want to allow.
5. On your next device, sign in with the same email and password.

Only approved accounts can read or write the `avScheduler` data. Anyone else, even signed in, is refused by the rules. Signing out keeps the data on that device.

## Backups

Data is saved in this browser for this web address. Clearing site data, using a private window or switching computers starts you empty unless cloud sync is on. Use **Settings, Download backup** now and then, and **Restore from backup** to move to another computer.

## Files

`index.html`, `css/app.css`, and `js/`:
`util` `store` (data + saving) `merge` and `cloud*` (sync) `audit` `scheduler` (rules and options) `inventory` (equipment check) `pdfimport` `signage` `logo-data` `pptx` `xlsx-export`, then `ui.js`, `filters.js`, the screens (`view-*.js`) and `app.js`. `firebase-rules.json` holds the database rules for cloud sync. No build step.
