=== Raffle Draw ===
Contributors: dvranic
Tags: raffle, lottery, giveaway, draw, block
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Draw raffle winners live on spinning digit reels, from a CSV of ticket numbers. Fair, offline once loaded, styled by your theme.

== Description ==

Upload a CSV of ticket numbers, list your prizes, put the page on a projector and press Draw (or Space).

* Fair: cryptographic randomness with rejection sampling; each number wins once.
* Optional weights: a ticket with weight 5 is five times as likely to win.
* Works offline once the page has loaded.
* Colours and fonts come from your theme's theme.json.
* Prize labels, full-screen mode, reduced-motion support.

== Installation ==

1. Upload the plugin ZIP under Plugins → Add New → Upload Plugin and activate it.
2. Add the Raffle Draw block to a page and choose a CSV in the block settings.

== Frequently Asked Questions ==

= What does the CSV look like? =

Column 1: ticket number (digits only, leading zeros kept). Optional column 2: weight, a whole number of 1 or more. A header row is optional. Commas, semicolons and tabs all work.

= How do I reset the draw? =

Reload the page. Once someone has won, the browser asks first.

== Changelog ==

= 1.0.0 =
* First release.
