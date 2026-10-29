<?php
/**
 * Raffle Draw — the editor's pre-flight check.
 *
 * When an author picks a CSV, the editor asks this route what the stage will actually draw from.
 * It runs the same parser as render.php and returns counts only: the editor never needs the ticket
 * numbers themselves, so the response stays a few hundred bytes however big the file is.
 *
 * @package RaffleDraw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register GET /raffle-draw/v1/preflight?attachment=<id>.
 */
function dvranic_raffle_draw_register_rest(): void {
	register_rest_route(
		'raffle-draw/v1',
		'/preflight',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dvranic_raffle_draw_preflight',
			// A ticket list is not public data; anyone who can upload the file can check it.
			'permission_callback' => static function () {
				return current_user_can( 'upload_files' );
			},
			'args'                => array(
				'attachment' => array(
					'type'     => 'integer',
					'required' => true,
					'minimum'  => 1,
				),
			),
		)
	);
}
add_action( 'rest_api_init', 'dvranic_raffle_draw_register_rest' );

/**
 * @param WP_REST_Request $request Request carrying the `attachment` ID.
 * @return WP_REST_Response|WP_Error Summary of the file, or an error the editor shows as-is.
 */
function dvranic_raffle_draw_preflight( WP_REST_Request $request ) {
	$id = (int) $request->get_param( 'attachment' );

	if ( ! dvranic_raffle_draw_is_csv_attachment( $id ) ) {
		return new WP_Error(
			'raffle_draw_not_csv',
			__( 'That file is not a CSV in the Media Library.', 'raffle-draw' ),
			array( 'status' => 404 )
		);
	}

	$parsed  = dvranic_raffle_draw_parse_attachment( $id );
	$weights = array();
	$tickets = 0;

	foreach ( $parsed['groups'] as $group ) {
		$count     = count( $group['entries'] );
		$weights[] = array(
			'weight' => $group['weight'],
			'count'  => $count,
		);
		$tickets  += $count * $group['weight'];
	}

	unset( $parsed['groups'] );

	return rest_ensure_response(
		array_merge(
			$parsed,
			array(
				'weights' => $weights,
				'tickets' => $tickets,
			)
		)
	);
}
