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
