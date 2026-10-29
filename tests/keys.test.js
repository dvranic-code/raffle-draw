import { describe, it, expect } from 'vitest';
import { shouldDrawOnKey, spaceShortcutActive } from '../src/raffle-draw/keys';

const key = ( overrides = {} ) => ( {
	code: 'Space',
	repeat: false,
	target: { tagName: 'BODY', isContentEditable: false },
	...overrides,
} );

describe( 'shouldDrawOnKey', () => {
	it( 'draws on Space', () => {
		expect( shouldDrawOnKey( key() ) ).toBe( true );
	} );

	it( 'ignores other keys', () => {
		expect( shouldDrawOnKey( key( { code: 'Enter' } ) ) ).toBe( false );
	} );

	it( 'ignores a held key', () => {
		expect( shouldDrawOnKey( key( { repeat: true } ) ) ).toBe( false );
	} );

	it.each( [ 'INPUT', 'TEXTAREA', 'SELECT' ] )(
		'leaves Space alone in a %s',
		( tagName ) => {
			expect(
				shouldDrawOnKey(
					key( { target: { tagName, isContentEditable: false } } )
				)
			).toBe( false );
		}
	);

	it( 'leaves Space alone in contenteditable', () => {
		expect(
			shouldDrawOnKey(
				key( { target: { tagName: 'DIV', isContentEditable: true } } )
			)
		).toBe( false );
	} );

	it( 'ignores Space when target is the draw button, which clicks itself', () => {
		expect(
			shouldDrawOnKey(
				key( {
					target: { tagName: 'BUTTON', isContentEditable: false },
				} )
			)
		).toBe( false );
	} );

	it( 'copes with an event that has no target', () => {
		expect( shouldDrawOnKey( key( { target: null } ) ) ).toBe( true );
	} );
} );

describe( 'spaceShortcutActive', () => {
	it( 'listens everywhere in event mode', () => {
		expect( spaceShortcutActive( true, false ) ).toBe( true );
	} );

	it( 'outside event mode, listens only while the stage is full screen', () => {
		expect( spaceShortcutActive( false, false ) ).toBe( false );
		expect( spaceShortcutActive( false, true ) ).toBe( true );
	} );
} );
