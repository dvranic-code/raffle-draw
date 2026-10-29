import { describe, it, expect } from 'vitest';
import {
	totalWeight,
	randomIntBelow,
	createCryptoRng,
	pickEntry,
	removeEntry,
} from '../src/raffle-draw/lottery';

const groups = [
	{ weight: 1, entries: [ '1', '2' ] },
	{ weight: 10, entries: [ '9' ] },
];

/**
 * A fake RNG that always returns the same ticket.
 *
 * @param {number} ticket The ticket to return.
 */
const fixed = ( ticket ) => () => ticket;

describe( 'totalWeight', () => {
	it( 'sums entries × weight across groups', () => {
		expect( totalWeight( groups ) ).toBe( 12 );
	} );

	it( 'is 0 for an empty pot', () => {
		expect( totalWeight( [] ) ).toBe( 0 );
	} );
} );

describe( 'randomIntBelow', () => {
	it( 'discards values in the biased tail of the uint32 range', () => {
		const sequence = [ 4294967295, 5 ];
		const next = () => sequence.shift();

		// 4294967295 is above the largest multiple of 3, so it is re-drawn; 5 % 3 = 2.
		expect( randomIntBelow( 3, next ) ).toBe( 2 );
		expect( sequence ).toHaveLength( 0 );
	} );

	it.each( [ 0, -1, 1.5, NaN ] )( 'throws on range %p', ( max ) => {
		expect( () => randomIntBelow( max, () => 0 ) ).toThrow( RangeError );
	} );
} );

describe( 'createCryptoRng', () => {
	it( 'stays inside the range', () => {
		const rng = createCryptoRng();

		for ( let i = 0; i < 1000; i++ ) {
			const value = rng( 7 );
			expect( value ).toBeGreaterThanOrEqual( 0 );
			expect( value ).toBeLessThan( 7 );
		}
	} );
} );

describe( 'pickEntry', () => {
	it( 'maps a ticket in the first group to its entry', () => {
		expect( pickEntry( groups, fixed( 1 ) ) ).toEqual( {
			group: 0,
			index: 1,
			number: '2',
		} );
	} );

	it( 'maps every ticket of a heavy entry back to that entry', () => {
		for ( let ticket = 2; ticket < 12; ticket++ ) {
			expect( pickEntry( groups, fixed( ticket ) ) ).toEqual( {
				group: 1,
				index: 0,
				number: '9',
			} );
		}
	} );

	it( 'with one entry always returns it', () => {
		const one = [ { weight: 3, entries: [ '007' ] } ];

		for ( let ticket = 0; ticket < 3; ticket++ ) {
			expect( pickEntry( one, fixed( ticket ) ).number ).toBe( '007' );
		}
	} );

	it( 'throws if the rng returns a ticket outside the pot', () => {
		expect( () => pickEntry( groups, fixed( 12 ) ) ).toThrow( RangeError );
	} );

	it( 'follows the weights over many draws', () => {
		// Seeded LCG so the test is deterministic.
		let seed = 42;
		const rng = ( max ) => {
			seed = ( seed * 1664525 + 1013904223 ) % 4294967296;
			return randomIntBelow( max, () => seed );
		};

		const pot = [
			{ weight: 1, entries: [ 'a' ] },
			{ weight: 3, entries: [ 'b' ] },
		];

		let heavy = 0;
		const draws = 30000;

		for ( let i = 0; i < draws; i++ ) {
			if ( pickEntry( pot, rng ).number === 'b' ) {
				heavy++;
			}
		}

		expect( heavy / draws ).toBeGreaterThan( 0.72 );
		expect( heavy / draws ).toBeLessThan( 0.78 );
	} );
} );

describe( 'removeEntry', () => {
	it( 'returns new groups without the entry and leaves the input alone', () => {
		const result = removeEntry( groups, 0, 0 );

		expect( result ).toEqual( [
			{ weight: 1, entries: [ '2' ] },
			{ weight: 10, entries: [ '9' ] },
		] );
		expect( groups[ 0 ].entries ).toEqual( [ '1', '2' ] );
	} );

	it( 'drops a group once it is empty', () => {
		expect( removeEntry( groups, 1, 0 ) ).toEqual( [
			{ weight: 1, entries: [ '1', '2' ] },
		] );
	} );
} );
