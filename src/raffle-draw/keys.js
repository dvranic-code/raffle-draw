/**
 * Raffle Draw — which key presses start a draw.
 *
 * Pulled out of view.js so it can be tested without a browser.
 */

/** Elements where Space means "type a space", not "draw". */
const TYPING_TAGS = [ 'INPUT', 'TEXTAREA', 'SELECT' ];

/**
 * Should this keydown start a draw?
 *
 * Space, and only Space: a presenter clicker or the operator's thumb. Not while someone is typing,
 * not on key-repeat (a held key would queue draws), and not when focus is on a button — a focused
 * button already turns Space into its own click, so handling it here as well would draw twice.
 *
 * @param {KeyboardEvent} event
 * @return {boolean} True to draw.
 */
export function shouldDrawOnKey( event ) {
	if ( event.code !== 'Space' || event.repeat ) {
		return false;
	}

	const target = event.target;

	if ( ! target ) {
		return true;
	}

	if ( target.isContentEditable ) {
		return false;
	}

	return ! [ ...TYPING_TAGS, 'BUTTON' ].includes( target.tagName );
}

/**
 * Is the Space shortcut listening at all?
 *
 * In event mode the stage owns the page, so Space draws from anywhere. Outside it — a block sitting
 * in the middle of an article — Space belongs to the reader for scrolling, and only draws while the
 * stage is in full screen.
 *
 * @param {boolean} eventMode         The block's Event mode setting.
 * @param {boolean} isStageFullscreen Whether this stage is the full-screen element.
 * @return {boolean} True if Space should be handled.
 */
export function spaceShortcutActive( eventMode, isStageFullscreen ) {
	return eventMode || isStageFullscreen;
}
