# Raffle Draw

A WordPress block for drawing raffle winners live, on a big screen, with spinning digit reels.

Upload a CSV of ticket numbers, list your prizes, put the page on a projector and press **Draw**
(or Space). Built for sponsor raffles at conferences and meetups, gala dinners, school fairs —
anywhere people hold a ticket number and wait to hear it.

- **Fair.** Uses the browser's cryptographic random source with rejection sampling. Never
  `Math.random()`. A number can only win once.
- **Weighted, if you want.** Everyone has the same chance by default. Add a weight column and a
  ticket with weight 5 is five times as likely to win.
- **Offline once loaded.** All tickets travel with the page. Venue Wi-Fi can drop mid-draw.
- **Looks like your site.** Colours and fonts come from your theme's `theme.json`. The block has the
  usual colour, typography and spacing settings, and the Draw button uses your theme's button style.
- **No dependencies.** WordPress core only. No settings page, no database tables.

<!-- Screenshot: add docs/screenshot.png -->

## Requirements

WordPress 6.6 or newer, PHP 7.4 or newer.

## Install

1. Download the ZIP from the [latest release](https://github.com/dvranic-code/raffle-draw/releases)
   (or **Code → Download ZIP**).
2. **Plugins → Add New → Upload Plugin**, choose the ZIP, activate.
3. Add the **Raffle Draw** block to a page.

No build step is needed: the compiled `build/` folder is part of the repository.

## The CSV

Column 1 is the ticket number. Column 2 is an optional weight.

```csv
ticket,weight
0001,1
0042,1
2154,1
3001,5
4096,10
```

- Ticket numbers are **digits only**, up to 12 of them. Leading zeros are kept: `007` stays `007`.
- Mixed lengths are fine. The stage shows as many reels as the longest number has digits, and pads
  shorter numbers with zeros. (So `7` and `007` are different tickets but look the same on the reels
  when the longest number has three digits — avoid mixing the two.)
- **Weight** is a whole number of 1 or more. Leave the column out and everyone has the same chance.
  Anything that is not a whole number of 1 or more counts as 1.
- A header row is optional and detected automatically.
- Commas, semicolons (European Excel) and tabs all work, and so does a UTF-8 BOM.
- A number listed twice is one ticket; the first line counts.

When you choose the file, the block settings show what was read: how many tickets, how many digits,
and anything that was skipped. Fix the file before the event, not during it.

There is a sample in [`docs/sample-tickets.csv`](docs/sample-tickets.csv).

## On the day

- **Prizes** are drawn in list order, top to bottom. Put the grand prize last for suspense. With no
  prizes listed, set a number of winners instead.
- **Draw** with the button, a click, a touch or Space. A presenter clicker that sends Space works.
- **Full screen**: the icon in the top-right corner hides your site's header and footer. It keeps
  the background the block sits on, or pick a colour under **Event & full screen → Full-screen
  background**.
- **Reset** by reloading the page. Once someone has won, the browser asks before it reloads.

### Event mode

On by default: the page is the stage. Space draws from anywhere on the page, and leaving after a
draw asks first.

Turn it off (**Event & full screen → Event mode**) when the block sits inside an article as a demo.
Space then scrolls the page as usual and only draws while the stage is in full screen, and readers
can leave without a prompt. The Draw button works either way.
- People who ask their system for reduced motion get a short fade instead of spinning reels.

## How it works

| Part | WordPress API | Why |
| --- | --- | --- |
| Block definition | Block API (`block.json`, `render.php`) | Dynamic block: the server renders the stage from the current CSV |
| Look | `theme.json` presets + block supports | No colours or fonts of its own |
| Editor check | REST API (`raffle-draw/v1/preflight`) | The editor reports what the *server's* parser sees — one parser, no drift |
| The stage | Interactivity API (`viewScriptModule`, `data-wp-*`) | Server-rendered markup, small reactive store, no framework to ship |

The draw itself is a pure function in [`src/raffle-draw/lottery.js`](src/raffle-draw/lottery.js).
Entries are grouped by weight, so a ticket maps back to its entry with arithmetic and the drum of
tickets is never built: a draw costs the same for 100 tickets or 10 million.

## Restyle it

Every colour is a custom property. Set any of these on `.wp-block-dvranic-raffle-draw` in your theme:

```css
.wp-block-dvranic-raffle-draw {
	--raffle-draw-accent: hotpink;   /* reel frame, filled winner border */
	--raffle-draw-face: #fff;        /* reel background */
	--raffle-draw-ink: #111;         /* digits */
	--raffle-draw-stage: #000;       /* full-screen background (overrides the editor setting) */
	--raffle-draw-overlay: #000;     /* tint over the background image */
}
```

## Ideas for making it yours

- Confetti when the last reel lands (hook into the end of `actions.draw` in `view.js`).
- Names instead of numbers — swap the reels for a scrolling list, keep `lottery.js` as it is.
- Save the winners to post meta through a REST route, for an audit trail.
- A sound per reel stop.

Pull requests welcome.

## Develop

```sh
npm install
npm start          # watch
npm run build      # production build into build/
npm test           # JS (Vitest) + PHP tests
npm run lint:js
npm run plugin-zip # installable ZIP
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).

Made by [Dejan Rudić Vranić](https://dejan.studioagnis.com/).
