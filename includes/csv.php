<?php
/**
 * Raffle Draw — reading the ticket CSV.
 *
 * One parser, two callers: render.php (what the stage draws from) and the editor's REST pre-flight
 * (what the author is told about the file). Parsing again in JavaScript for the editor would give two
 * sources of truth that drift apart; the editor asks this one over REST instead.
 *
 * @package RaffleDraw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Mime types a hand-exported CSV shows up as, depending on the machine that made it.
 */
const DVRANIC_RAFFLE_DRAW_CSV_MIMES = array(
	'text/csv',
	'application/csv',
	'text/plain',
	'text/tab-separated-values',
);

/**
 * Longest ticket number accepted. Every digit becomes a reel of 60 elements, so an absurd "number"
 * in the file would otherwise turn into an absurd page. Twelve covers any real ticket book.
 */
const DVRANIC_RAFFLE_DRAW_MAX_DIGITS = 12;

/**
 * The shape every parse returns, so callers never have to check for missing keys.
 *
 * @return array{groups: array<int, array{weight: int, entries: string[]}>, entries: int, digits: int, rows: int, skipped: int, duplicates: int, invalid_weights: int}
 */
function dvranic_raffle_draw_empty_result(): array {
	return array(
		'groups'          => array(),
		'entries'         => 0,
		'digits'          => 0,
		'rows'            => 0,
		'skipped'         => 0,
		'duplicates'      => 0,
		'invalid_weights' => 0,
	);
}

/**
 * Guess the delimiter from the first line.
 *
 * Excel in most of Europe writes semicolons, which is the most likely way a real file differs from
 * the example in the README.
 *
 * @param string $line First line of the file.
 * @return string One of ; , or a tab.
 */
function dvranic_raffle_draw_sniff_delimiter( string $line ): string {
	$counts = array(
		';'  => substr_count( $line, ';' ),
		','  => substr_count( $line, ',' ),
		"\t" => substr_count( $line, "\t" ),
	);

	arsort( $counts );
	$delimiter = (string) key( $counts );

	return $counts[ $delimiter ] > 0 ? $delimiter : ',';
}

/**
 * Read a ticket CSV: column 1 is the ticket number, column 2 an optional weight.
 *
 * Deliberately forgiving, because a person exports this file shortly before the event: it accepts
 * , ; or tab, a UTF-8 BOM, CRLF line endings, quoted cells, stray spaces and an optional header row.
 * Anything it cannot use is counted rather than dropped silently, so the editor can say so.
 *
 * - A ticket number is digits only, at most DVRANIC_RAFFLE_DRAW_MAX_DIGITS long. Leading zeros are
 *   kept: "007" stays "007".
 * - A weight is a whole number of 1 or more. Missing means 1. Anything else (0, -3, 2.5, "abc") is
 *   also treated as 1 and counted — a weight of 0 would quietly take a ticket out of the draw.
 * - A number listed twice is one ticket; the first occurrence wins.
 *
 * Entries come back grouped by weight, lightest first. That grouping is what lets the browser draw
 * without ever building the drum — see src/raffle-draw/lottery.js.
 *
 * @param string $path Absolute path to the CSV.
 * @return array See dvranic_raffle_draw_empty_result().
 */
function dvranic_raffle_draw_parse_csv_file( string $path ): array {
	$result = dvranic_raffle_draw_empty_result();

	if ( ! $path || ! is_file( $path ) || ! is_readable( $path ) ) {
		return $result;
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- streaming a local upload.
	$handle = fopen( $path, 'r' );

	if ( ! $handle ) {
		return $result;
	}

	$first_line = fgets( $handle );

	if ( false === $first_line ) {
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		return $result;
	}

	$delimiter = dvranic_raffle_draw_sniff_delimiter( $first_line );
	rewind( $handle );

	$weights      = array(); // number => weight, in order of first appearance.
	$is_first_row = true;

	// An empty escape character turns off PHP's non-standard backslash escaping (RFC 4180 behaviour).
	while ( ( $row = fgetcsv( $handle, 0, $delimiter, '"', '' ) ) !== false ) { // phpcs:ignore WordPress.CodeAnalysis.AssignmentInCondition.FoundInWhileCondition
		$number = trim( str_replace( "\xEF\xBB\xBF", '', (string) ( $row[0] ?? '' ) ) );
		$weight = trim( (string) ( $row[1] ?? '' ) );

		if ( '' === $number && '' === $weight ) {
			continue; // Blank line.
		}

		if ( $is_first_row ) {
			$is_first_row = false;

			// A first row that does not start with a ticket number is a header. It is not data, so
			// it is not counted as skipped either.
			if ( ! ctype_digit( $number ) ) {
				continue;
			}
		}

		++$result['rows'];

		if ( ! ctype_digit( $number ) || strlen( $number ) > DVRANIC_RAFFLE_DRAW_MAX_DIGITS ) {
			++$result['skipped'];
			continue;
		}

		if ( isset( $weights[ $number ] ) ) {
			++$result['duplicates'];
			continue;
		}

		if ( '' === $weight ) {
			$weight = 1;
		} elseif ( ctype_digit( $weight ) && (int) $weight >= 1 ) {
			$weight = (int) $weight;
		} else {
			++$result['invalid_weights'];
			$weight = 1;
		}

		$weights[ $number ] = $weight;
	}

	fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

	$groups = array();

	foreach ( $weights as $number => $weight ) {
		$number = (string) $number; // PHP turns numeric-string array keys into ints; "007" survives, "42" does not.

		$groups[ $weight ][] = $number;
		$result['digits']    = max( $result['digits'], strlen( $number ) );
	}

	ksort( $groups );

	foreach ( $groups as $weight => $entries ) {
		$result['groups'][] = array(
			'weight'  => (int) $weight,
			'entries' => $entries,
		);
	}

	$result['entries'] = count( $weights );

	return $result;
}

/**
 * Same as dvranic_raffle_draw_parse_csv_file(), addressed by Media Library ID.
 *
 * @param int $attachment_id Attachment ID of the CSV.
 * @return array See dvranic_raffle_draw_empty_result(). Empty if the ID is not a CSV attachment.
 */
function dvranic_raffle_draw_parse_attachment( int $attachment_id ): array {
	if ( ! dvranic_raffle_draw_is_csv_attachment( $attachment_id ) ) {
		return dvranic_raffle_draw_empty_result();
	}

	return dvranic_raffle_draw_parse_csv_file( (string) get_attached_file( $attachment_id ) );
}

/**
 * @param int $attachment_id Attachment ID.
 * @return bool Whether the ID points at an attachment with a CSV-ish mime type.
 */
function dvranic_raffle_draw_is_csv_attachment( int $attachment_id ): bool {
	if ( $attachment_id < 1 || 'attachment' !== get_post_type( $attachment_id ) ) {
		return false;
	}

	return in_array( get_post_mime_type( $attachment_id ), DVRANIC_RAFFLE_DRAW_CSV_MIMES, true );
}

/**
 * The labels of the winner slots, in draw order.
 *
 * Prizes win over the plain count: three prizes means three winners. Either way there are never
 * more slots than tickets, because each ticket can only win once.
 *
 * @param array $prizes        Prize names from the editor, top to bottom.
 * @param int   $winners_count Used only when there are no prizes; clamped to 1–50.
 * @param int   $entries       How many tickets are in the draw.
 * @return string[] One label per slot.
 */
function dvranic_raffle_draw_slot_labels( array $prizes, int $winners_count, int $entries ): array {
	$prizes = array_values(
		array_filter(
			array_map(
				static function ( $prize ) {
					return is_string( $prize ) ? trim( $prize ) : '';
				},
				$prizes
			),
			'strlen'
		)
	);

	if ( $prizes ) {
		$labels = $prizes;
	} else {
		$labels = array();
		$count  = max( 1, min( 50, $winners_count ) );

		for ( $slot = 1; $slot <= $count; $slot++ ) {
			/* translators: %d: position of the winner, starting at 1. */
			$labels[] = sprintf( __( 'Winner %d', 'raffle-draw' ), $slot );
		}
	}

	return array_slice( $labels, 0, max( 0, $entries ) );
}
