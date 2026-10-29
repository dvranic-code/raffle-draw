/**
 * Raffle Draw — the weighted draw.
 *
 * Pure and dependency-free on purpose: no DOM, no WordPress, no imports. view.js imports it, and the
 * tests run it in plain Node.
 *
 * The mental model is a raffle drum: an entry with weight 5 puts five tickets in the drum. We never
 * build that drum. Entries are grouped by weight on the server, and inside one group every entry has
 * the same number of tickets — so a group is one contiguous run of tickets, and the winning ticket
 * maps straight back to an entry with a division. A draw costs one step per distinct weight, whether
 * the drum holds 100 tickets or 10 million.
 *
 * Shape used throughout: groups = [ { weight: number, entries: string[] }, … ]
 */

/**
 * @param {Array<{weight: number, entries: string[]}>} groups
 * @return {number} How many tickets are in the drum.
 */
export function totalWeight( groups ) {
	return groups.reduce(
		( sum, group ) => sum + group.entries.length * group.weight,
		0
	);
}

/**
 * An unbiased integer in [0, max).
 *
 * `value % max` on its own is not uniform: 2^32 is rarely a multiple of max, so the last, partial
 * block of the uint32 range would make the lowest results slightly more likely. Values that land in
 * that block are thrown away and drawn again (rejection sampling).
 *
 * @param {number}       max        Exclusive upper bound, a positive integer.
 * @param {() => number} nextUint32 Source of raw 32-bit values.
 * @return {number} The drawn value.
 */
export function randomIntBelow( max, nextUint32 ) {
	if ( ! Number.isInteger( max ) || max < 1 ) {
		throw new RangeError(
			`randomIntBelow: range must be a positive integer, got ${ max }`
		);
	}

	const limit = Math.floor( 4294967296 / max ) * max;

	let value = nextUint32();
	while ( value >= limit ) {
		value = nextUint32();
	}

	return value % max;
}

/**
 * The random source for real draws. Never Math.random() — people win prizes with this.
 *
 * @param {Crypto} source Anything with getRandomValues(); defaults to the browser's crypto.
 * @return {(max: number) => number} Unbiased integer generator.
 */
export function createCryptoRng( source = globalThis.crypto ) {
	const buffer = new Uint32Array( 1 );

	const nextUint32 = () => {
		source.getRandomValues( buffer );
		return buffer[ 0 ];
	};

	return ( max ) => randomIntBelow( max, nextUint32 );
}

/**
 * Draw one winner. Does not modify `groups` — pass the result to removeEntry() to take it out.
 *
 * @param {Array<{weight: number, entries: string[]}>} groups
 * @param {(max: number) => number}                    rng
 * @return {{group: number, index: number, number: string}} The winning entry.
 */
export function pickEntry( groups, rng ) {
	let ticket = rng( totalWeight( groups ) );

	for ( let group = 0; group < groups.length; group++ ) {
		const { weight, entries } = groups[ group ];
		const span = entries.length * weight;

		if ( ticket < span ) {
			const index = Math.floor( ticket / weight );
			return { group, index, number: entries[ index ] };
		}

		ticket -= span;
	}

	// Only reachable if rng returned a ticket outside the drum it was given.
	throw new RangeError( 'pickEntry: ticket fell outside the drum' );
}

/**
 * Groups with one entry taken out, so a number that has won cannot win again.
 *
 * @param {Array<{weight: number, entries: string[]}>} groups
 * @param {number}                                     group
 * @param {number}                                     index
 * @return {Array<{weight: number, entries: string[]}>} New groups; empty ones are dropped.
 */
export function removeEntry( groups, group, index ) {
	return groups
		.map( ( current, position ) =>
			position === group
				? {
						...current,
						entries: current.entries.filter(
							( _entry, i ) => i !== index
						),
					}
				: current
		)
		.filter( ( current ) => current.entries.length > 0 );
}
