/**
 * Raffle Draw — which background to take into full screen.
 *
 * In full screen the stage is shown on its own, so it loses whatever the page painted behind it.
 * Without a colour chosen in the editor, we borrow the nearest ancestor's background colour. Kept
 * pure (a list of computed colours in, one colour out) so it can be tested without a browser.
 */

/**
 * @param {string[]} colors Computed background colours, nearest ancestor first.
 * @return {string} The first one that is not transparent, or '' if none is.
 */
export function firstOpaqueColor( colors ) {
	const opaque = colors.find(
		( color ) =>
			color &&
			color !== 'transparent' &&
			! /^rgba\(.*,\s*0\)$/.test( color )
	);

	return opaque || '';
}
