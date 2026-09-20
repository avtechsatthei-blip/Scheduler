# iHotel AV Scheduler

One page for the AV team's week at Hotel Illinois Conference Center: events, staff, equipment, schedule options, room signs, PowerPoint export and PDF import. It runs entirely in the browser, so it hosts on GitHub Pages like the iHotel messaging app.

## Put it online (GitHub Pages)

1. Create a new repository on GitHub (for example `iHotel-scheduler`).
2. Upload everything in this folder, keeping the `css/` and `js/` folders. On github.com use **Add file, Upload files** and drag the contents in.
3. In the repository go to **Settings, Pages**. Under **Build and deployment** choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the app is at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

Notes
- GitHub Pages sites are public. Nothing you type goes to GitHub: your data lives only in your browser (see Backups).
- Private repositories need a paid GitHub plan to use Pages.
- The app loads a few things from the internet on demand: Montserrat and Ovo fonts, your logo from the messaging repository, and, only when used, PDF.js and the text reader (PDF import), PptxGenJS (PowerPoint) and JSZip (ZIP of signs).

## First run

1. **Equipment**: replace the placeholder counts with what you own. Set which items can be rented and roughly what a rental costs per day.
2. **Rooms**: check each room's standard AV kit. Mark items as *installed* if they're permanently in the room, so they don't count against inventory.
3. **Staff**: add people with weekly minimum and maximum hours, the days and times they prefer, and any days off.
4. **Events**: type them in, or import an event-sheet PDF and review the drafts.
5. **Schedule**: press *Build options*, compare, preview and use one. Click a shift to edit, lock or delete it, or drag it to someone else on the same day.

*Settings, Your data, Load sample week* fills everything with demo data so you can try it first.

## How scheduling works

Each event that needs AV creates staff needs from the event hours plus your before and after buffers.

- One *room coverage* person owns the rooms for the day (overlapping or nearby events share one person; long days are split at the longest-shift limit).
- Each in-room tech seat on an event adds one extra *tech* shift.
- Short needs are padded to the shortest-shift setting.

Hard rules that every option follows: weekday availability, days off, tech eligibility, no overlaps, minimum rest between shifts, daily maximum, weekly maximum. Soft goals that differ by option: hitting weekly minimums, staying inside preferred hours, sharing hours evenly, fewest people, keeping one person on the same event, avoiding overtime. If someone can't be found for a shift it stays *open* and is listed as a problem.

All numbers are in **Settings**.

## PDF import

*Events, Import PDF* reads the real text on Notes pages (room, date, setup, AV items, in-room tech) and runs text recognition on floor-plan pages, which have no text layer, to find the agenda times and tech counts. Everything comes in as a draft table you fix before adding. Imported events with something worth checking show a **Review** badge. Recognition takes roughly a second or two per page on a modern laptop after a one-time download.

## Room signs and PowerPoint

- **Room signs** makes 1920x1080 PNGs (event name centered, room name along the bottom). *Classic gray* matches the example sign; *iHotel blue and orange* is the brand version. Download one, or tick several for a ZIP.
- **PowerPoint** exports one or more weeks: staff schedule grid, event list with staffing, equipment check, and optionally one sign per event. Signs can be editable text (uses the Montserrat font; install it on the computer that opens the deck) or exact pictures.

## Backups

Data is saved in this browser for this web address. Clearing site data, using a private window or switching computers starts you empty. Use **Settings, Download backup** regularly and **Restore from backup** to move to another computer.

## Files

`index.html`, `css/app.css`, and `js/`:
`util` `store` (data + saving) `scheduler` (rules and options) `inventory` (equipment check) `pdfimport` `signage` `pptx`, then the screens (`view-*.js`), `ui.js` and `app.js`. No build step.
