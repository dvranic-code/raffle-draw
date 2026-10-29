<?php
/**
 * Raffle Draw — server render.
 *
 * Renders the whole stage and hands the browser everything it needs to draw in
 * `data-wp-context`: the tickets (grouped by weight), the slot labels and the per-reel state. From
 * here on nothing touches the network — the draw survives venue Wi-Fi going down mid-event.
 *
 * @package RaffleDraw
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused, the block has no inner blocks.
 * @var WP_Block $block      Block instance.
 */

defined( 'ABSPATH' ) || exit;

/*
 * How many times 0-9 repeats inside one reel strip. Shared with REEL_PASSES in view.js and
 * --raffle-draw-passes in style.scss — change all three together, or the reels land on the wrong
 * digit. A reel travels at most four passes in one stop, so six leaves room.
 */
if ( ! defined( 'DVRANIC_RAFFLE_DRAW_REEL_PASSES' ) ) {
	define( 'DVRANIC_RAFFLE_DRAW_REEL_PASSES', 6 );
}

$parsed = dvranic_raffle_draw_parse_attachment( (int) ( $attributes['csvId'] ?? 0 ) );

if ( 0 === $parsed['entries'] ) {
	// Visitors see nothing; editors are told why, because an empty stage is the one surprise
	// nobody wants in front of an audience.
	if ( current_user_can( 'edit_posts' ) ) {
		printf(
			'<p %s>%s</p>',
			get_block_wrapper_attributes( array( 'class' => 'is-empty' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			esc_html__( 'Raffle Draw: no ticket numbers found. Upload a CSV in the block settings.', 'raffle-draw' )
		);
	}

	return;
}

$digits = max( 1, $parsed['digits'] );
$slots  = dvranic_raffle_draw_slot_labels(
	(array) ( $attributes['prizes'] ?? array() ),
	(int) ( $attributes['winnersCount'] ?? 3 ),
	$parsed['entries']
);

$headline  = trim( (string) ( $attributes['headline'] ?? '' ) );
$bg_id     = (int) ( $attributes['bgImageId'] ?? 0 );
$dim_ratio = max( 0, min( 100, (int) ( $attributes['dimRatio'] ?? 50 ) ) );

$context = array(
	'groups'         => $parsed['groups'],
	'digits'         => $digits,
	'slots'          => $slots,
	'winners'        => array(),
	'current'        => 0,
	'isSpinning'     => false,
	'isFinished'     => false,
	'announce'       => '',
	// Script modules cannot load JS translations yet, so the one sentence the browser builds is
	// translated here and travels with the context.
	/* translators: 1: prize or winner label, 2: winning ticket number. */
	'announceFormat' => __( '%1$s: ticket %2$s', 'raffle-draw' ),
	// Per-reel state, seeded so the bound getters never read an undefined index on first render.
	'reelSpinning'   => array_fill( 0, $digits, false ),
	'reelLanding'    => array_fill( 0, $digits, false ),
	'reelFrom'       => array_fill( 0, $digits, 0 ),
	'reelTo'         => array_fill( 0, $digits, 0 ),
);

/*
 * Every element whose text changes during the draw carries translate="no". Browser page translation
 * (Chrome's built-in translate, for one) swaps text nodes for its own <font> wrappers. The
 * Interactivity API keeps writing to the original nodes, which are no longer in the page, so the
 * stage silently freezes. Static text (headline, prize names, button) stays translatable.
 */
$wrapper = get_block_wrapper_attributes(
	array(
		'class' => $bg_id ? 'has-background-image' : '',
		'style' => '--raffle-draw-digits:' . $digits . ';--raffle-draw-dim:' . ( $dim_ratio / 100 ) . ';',
	)
);
?>
<section
	<?php echo $wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	data-wp-interactive="dvranic/raffle-draw"
	<?php echo wp_interactivity_data_wp_context( $context ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	data-wp-on-window--keydown="actions.onKeydown"
	data-wp-on-window--beforeunload="actions.onBeforeUnload"
	data-wp-class--is-spinning="context.isSpinning"
	data-wp-class--is-finished="context.isFinished"
>
	<?php if ( $bg_id ) : ?>
		<div class="raffle-draw__background" aria-hidden="true">
			<?php
			echo wp_get_attachment_image(
				$bg_id,
				'full',
				false,
				array(
					'class'   => 'raffle-draw__background-image',
					'alt'     => '',
					'loading' => 'eager',
				)
			);
			?>
			<span class="raffle-draw__overlay"></span>
		</div>
	<?php endif; ?>

	<button
		type="button"
		class="raffle-draw__fullscreen"
		data-wp-on--click="actions.toggleFullscreen"
		aria-label="<?php esc_attr_e( 'Toggle full screen', 'raffle-draw' ); ?>"
	>
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z"/></svg>
	</button>

	<div class="raffle-draw__stage">
		<?php if ( $headline ) : ?>
			<h2 class="raffle-draw__headline"><?php echo esc_html( $headline ); ?></h2>
		<?php endif; ?>

		<p class="raffle-draw__now" data-wp-bind--hidden="context.isFinished">
			<span class="raffle-draw__now-label"><?php esc_html_e( 'Now drawing', 'raffle-draw' ); ?></span>
			<strong class="raffle-draw__now-prize" data-wp-text="state.nowLabel" translate="no"><?php echo esc_html( $slots[0] ?? '' ); ?></strong>
		</p>

		<div class="raffle-draw__reels" aria-hidden="true" translate="no">
			<?php for ( $reel = 0; $reel < $digits; $reel++ ) : ?>
				<div class="raffle-draw__reel" <?php echo wp_interactivity_data_wp_context( array( 'reel' => $reel ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
					<div
						class="raffle-draw__strip"
						data-wp-class--is-spinning="state.isReelSpinning"
						data-wp-class--is-landing="state.isReelLanding"
						data-wp-bind--style="state.reelStyle"
					>
						<?php
						for ( $pass = 0; $pass < DVRANIC_RAFFLE_DRAW_REEL_PASSES; $pass++ ) {
							for ( $digit = 0; $digit <= 9; $digit++ ) {
								echo '<span class="raffle-draw__digit">' . (int) $digit . '</span>';
							}
						}
						?>
					</div>
				</div>
			<?php endfor; ?>
		</div>

		<div class="wp-block-button raffle-draw__actions" data-wp-bind--hidden="context.isFinished">
			<button
				type="button"
				class="wp-block-button__link wp-element-button raffle-draw__draw"
				data-wp-on--click="actions.draw"
				data-wp-bind--disabled="context.isSpinning"
			>
				<?php esc_html_e( 'Draw', 'raffle-draw' ); ?>
			</button>
		</div>

		<ol class="raffle-draw__winners">
			<?php foreach ( $slots as $slot => $label ) : ?>
				<li
					class="raffle-draw__winner"
					<?php echo wp_interactivity_data_wp_context( array( 'slot' => $slot ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					data-wp-class--is-filled="state.isSlotFilled"
					data-wp-class--is-current="state.isSlotCurrent"
				>
					<span class="raffle-draw__winner-label"><?php echo esc_html( $label ); ?></span>
					<span class="raffle-draw__winner-number" data-wp-text="state.winnerNumber" translate="no"></span>
				</li>
			<?php endforeach; ?>
		</ol>

		<p class="raffle-draw__sr-only" role="status" aria-live="polite" data-wp-text="context.announce" translate="no"></p>
	</div>
</section>
