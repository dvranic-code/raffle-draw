/**
 * Raffle Draw — the stage (Interactivity API).
 *
 * Everything happens in the browser. The tickets arrive in `data-wp-context` with the page, so once
 * it has loaded the draw needs no network at all — venue Wi-Fi can go down mid-raffle.
 *
 * The draw itself lives in ./lottery.js (pure, tested in Node). This file is only choreography.
 *
 * HOW THE REELS MOVE
 * ------------------
 * Each strip holds REEL_PASSES × the digits 0-9, and every position is a **percentage** of the
 * strip's own height, so nothing here ever measures a pixel.
 *
 *   spinning   a CSS animation loops the strip up by exactly one pass, forever.
 *   stopping   we do not read the animated position back out of the DOM. We compute where the loop
 *              has got to from the clock (elapsed % loop) and hand that to a SECOND animation as its
 *              --from, with the winning digit a few passes further on as its --to.
 *
 * Both phases are animations and the handover is one synchronous state change. A version that froze
 * the strip and ran a CSS transition needed the change split across two frames with
 * requestAnimationFrame — which does not fire in a hidden tab, so the reels never landed on a number
 * that had already been drawn. Animations need no such dance: `forwards` holds the last frame.
 */

import { store, getContext, getElement } from '@wordpress/interactivity';
import {
	pickEntry,
	removeEntry,
	createCryptoRng,
	totalWeight,
} from './lottery';
import { shouldDrawOnKey, spaceShortcutActive } from './keys';
import { firstOpaqueColor } from './background';

/** Must match DVRANIC_RAFFLE_DRAW_REEL_PASSES in render.php and --raffle-draw-passes in style.scss. */
const REEL_PASSES = 6;

/** One pass of ten digits per loop. Must match --raffle-draw-spin in style.scss. */
const SPIN_LOOP_MS = 150;

const PASS_PCT = 100 / REEL_PASSES;
const CELL_PCT = PASS_PCT / 10;

/** Timing for a full show, and for people who asked their system for less motion. */
const TIMING = {
	full: { firstStop: 1600, stagger: 700, settle: 900 },
	reduced: { firstStop: 200, stagger: 0, settle: 300 },
};

const rng = createCryptoRng();

function timing() {
	const reduced =
		typeof window.matchMedia === 'function' &&
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	return reduced ? TIMING.reduced : TIMING.full;
}

/**
 * Where a strip sits right now, in percent, derived from the clock rather than the DOM.
 *
 * @param {number} elapsed Milliseconds since the spin started.
 * @return {number} Offset in percent, always inside one pass.
 */
function offsetAt( elapsed ) {
	return ( ( elapsed % SPIN_LOOP_MS ) / SPIN_LOOP_MS ) * PASS_PCT;
}

/**
 * Stop one reel on one digit.
 *
 * @param {Object} context Block context.
 * @param {number} reel    Reel index, left to right.
 * @param {number} digit   The digit to land on.
 * @param {number} started performance.now() when the spin began.
 */
function stopReel( context, reel, digit, started ) {
	const current = offsetAt( performance.now() - started );

	// Land two to three passes further on, on the cell showing `digit`.
	const base = current + 2 * PASS_PCT;
	const delta =
		( ( ( digit * CELL_PCT - base ) % PASS_PCT ) + PASS_PCT ) % PASS_PCT;

	// One synchronous handover: the landing animation starts exactly where the loop had got to.
	context.reelFrom[ reel ] = current;
	context.reelTo[ reel ] = base + delta;
	context.reelSpinning[ reel ] = false;
	context.reelLanding[ reel ] = true;
}

const { actions } = store( 'dvranic/raffle-draw', {
	state: {
		get isReelSpinning() {
			const context = getContext();
			return context.reelSpinning[ context.reel ];
		},

		get isReelLanding() {
			const context = getContext();
			return context.reelLanding[ context.reel ];
		},

		/**
		 * The landing animation's endpoints. Bound as the whole style attribute, because
		 * `data-wp-style--` cannot address a custom property.
		 */
		get reelStyle() {
			const context = getContext();
			const { reel } = context;

			return `--from:${ context.reelFrom[ reel ] }%;--to:${ context.reelTo[ reel ] }%;--land-duration:${ timing().settle }ms`;
		},

		/** The prize being drawn next. */
		get nowLabel() {
			const context = getContext();
			return context.slots[ context.current ] || '';
		},

		get winnerNumber() {
			const context = getContext();
			return context.winners[ context.slot ] || '';
		},

		get isSlotFilled() {
			const context = getContext();
			return Boolean( context.winners[ context.slot ] );
		},

		get isSlotCurrent() {
			const context = getContext();
			return ! context.isFinished && context.slot === context.current;
		},
	},

	actions: {
		/**
		 * The Draw button, and Space from anywhere on the page.
		 */
		draw() {
			const context = getContext();

			if ( context.isSpinning || context.isFinished ) {
				return;
			}

			if ( totalWeight( context.groups ) < 1 ) {
				context.isFinished = true;
				return;
			}

			const pick = pickEntry( context.groups, rng );

			// A number that has won cannot win again.
			context.groups = removeEntry(
				context.groups,
				pick.group,
				pick.index
			);

			const number = String( pick.number ).padStart(
				context.digits,
				'0'
			);
			const { firstStop, stagger, settle } = timing();
			const started = performance.now();

			context.isSpinning = true;
			context.announce = '';

			for ( let reel = 0; reel < context.digits; reel++ ) {
				context.reelLanding[ reel ] = false;
				context.reelSpinning[ reel ] = true;

				setTimeout(
					() => {
						stopReel(
							context,
							reel,
							Number( number[ reel ] ),
							started
						);
					},
					firstStop + reel * stagger
				);
			}

			// The number only counts as drawn once the last reel has settled.
			const lastStop = firstStop + ( context.digits - 1 ) * stagger;

			setTimeout( () => {
				const label = context.slots[ context.current ];

				context.winners = [ ...context.winners, number ];
				context.current += 1;
				context.isSpinning = false;
				context.announce = context.announceFormat
					.replace( '%1$s', label )
					.replace( '%2$s', number );

				if (
					context.current >= context.slots.length ||
					totalWeight( context.groups ) < 1
				) {
					context.isFinished = true;
				}
			}, lastStop + settle );
		},

		/**
		 * @param {KeyboardEvent} event
		 */
		onKeydown( event ) {
			const context = getContext();
			const { ref } = getElement();

			if (
				! spaceShortcutActive(
					context.eventMode,
					document.fullscreenElement === ref
				)
			) {
				return;
			}

			// Swallow Space even on key-repeat, or a held key scrolls the stage away mid-spin.
			const spaceIsOurs = shouldDrawOnKey( {
				code: event.code,
				repeat: false,
				target: event.target,
			} );

			if ( ! spaceIsOurs ) {
				return;
			}

			event.preventDefault();

			if ( ! event.repeat ) {
				actions.draw();
			}
		},

		/**
		 * In event mode, once someone has won, an accidental reload asks first. A deliberate reload
		 * still resets the draw — that is the reset button. Outside event mode (a demo inside an
		 * article) readers come and go, so the browser is never asked to hold them.
		 *
		 * @param {BeforeUnloadEvent} event
		 */
		onBeforeUnload( event ) {
			const context = getContext();

			if ( ! context.eventMode || ! context.winners.length ) {
				return;
			}

			event.preventDefault();
			event.returnValue = '';
		},

		toggleFullscreen() {
			const { ref } = getElement();

			// A focused button turns Space into its own click, so Space would toggle full screen
			// instead of drawing. Let go of focus.
			ref.blur();

			if ( document.fullscreenElement ) {
				document.exitFullscreen();
				return;
			}

			const stage = ref.closest( '.wp-block-dvranic-raffle-draw' );

			if ( ! stage || ! stage.requestFullscreen ) {
				return;
			}

			// No colour chosen in the editor: take the background the stage was sitting on, so full
			// screen looks like the page rather than a white (or black) void.
			if ( ! getContext().hasFullscreenColor ) {
				const colors = [];
				for (
					let node = stage.parentElement;
					node;
					node = node.parentElement
				) {
					colors.push(
						window.getComputedStyle( node ).backgroundColor
					);
				}
				stage.style.setProperty(
					'--raffle-draw-inherited-bg',
					firstOpaqueColor( colors ) || 'Canvas'
				);
			}

			stage.requestFullscreen();
		},
	},
} );
