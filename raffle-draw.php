<?php
/**
 * Plugin Name:       Raffle Draw
 * Plugin URI:        https://github.com/dvranic-code/raffle-draw
 * Description:       A live raffle draw for the big screen: upload a CSV of ticket numbers and draw winners on spinning digit reels. Fair, offline once loaded, styled by your theme.
 * Version:           1.1.0
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Author:            Dejan Rudić Vranić
 * Author URI:        https://dejan.studioagnis.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       raffle-draw
 *
 * @package RaffleDraw
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/csv.php';
require_once __DIR__ . '/includes/rest.php';

/**
 * Register the block from its built block.json, and hand the editor script its translations.
 */
function dvranic_raffle_draw_register_block(): void {
	$block = register_block_type( __DIR__ . '/build/raffle-draw' );

	if ( $block && ! empty( $block->editor_script_handles ) ) {
		foreach ( $block->editor_script_handles as $handle ) {
			wp_set_script_translations( $handle, 'raffle-draw', __DIR__ . '/languages' );
		}
	}
}
add_action( 'init', 'dvranic_raffle_draw_register_block' );
