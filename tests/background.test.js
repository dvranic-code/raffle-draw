import { describe, it, expect } from 'vitest';
import { firstOpaqueColor } from '../src/raffle-draw/background';

describe( 'firstOpaqueColor', () => {
	it( 'skips transparent ancestors and returns the first real colour', () => {
		expect(
			firstOpaqueColor( [
				'rgba(0, 0, 0, 0)',
				'transparent',
				'rgb(230, 222, 200)',
				'rgb(247, 245, 240)',
			] )
		).toBe( 'rgb(230, 222, 200)' );
	} );

	it( 'treats a fully transparent rgba with any channels as transparent', () => {
		expect(
			firstOpaqueColor( [ 'rgba(255, 255, 255, 0)', 'rgb(1, 2, 3)' ] )
		).toBe( 'rgb(1, 2, 3)' );
	} );

	it( 'returns an empty string when nothing has a background', () => {
		expect( firstOpaqueColor( [ 'rgba(0, 0, 0, 0)' ] ) ).toBe( '' );
		expect( firstOpaqueColor( [] ) ).toBe( '' );
	} );
} );
