<?php
/**
 * Dependency-free test runner for the CSV parser: `php tests/php/run.php`.
 *
 * The parser only needs __() from WordPress, so a stub is enough — no WordPress test suite, no
 * PHPUnit, nothing to install.
 */

define( 'ABSPATH', __DIR__ );

function __( $text ) {
	return $text;
}

require dirname( __DIR__, 2 ) . '/includes/csv.php';

$failures = 0;
$tests    = 0;

function check( string $name, $expected, $actual ): void {
	global $failures, $tests;
	++$tests;

	if ( $expected === $actual ) {
		echo "  ok  {$name}\n";
		return;
	}

	++$failures;
	echo "FAIL  {$name}\n      expected: " . var_export( $expected, true ) . "\n      actual:   " . var_export( $actual, true ) . "\n";
}

function parse( string $fixture ): array {
	return dvranic_raffle_draw_parse_csv_file( __DIR__ . "/fixtures/{$fixture}.csv" );
}

// test_plain_comma
$r = parse( 'plain' );
check( 'test_plain_comma: one group of weight 1', array( array( 'weight' => 1, 'entries' => array( '1001', '1002', '1003' ) ) ), $r['groups'] );
check( 'test_plain_comma: counts', array( 3, 4, 3, 0 ), array( $r['entries'], $r['digits'], $r['rows'], $r['skipped'] ) );

// test_semicolon_bom_crlf_quoted
check( 'test_semicolon_bom_crlf_quoted: same as plain comma file', parse( 'excel-semicolon-equivalent' ), parse( 'excel-semicolon' ) );

// test_header_detected + test_leading_zeros_kept_and_digits_is_longest
$r = parse( 'header-mixed-lengths' );
check( 'test_header_detected: header not counted as a row', 3, $r['rows'] );
check( 'test_leading_zeros_kept', array( '001', '2154', '00281311' ), $r['groups'][0]['entries'] );
check( 'test_digits_is_longest', 8, $r['digits'] );

// test_non_digit_rows_skipped
$r = parse( 'non-digits' );
check( 'test_non_digit_rows_skipped', array( 4, 2, 2 ), array( $r['rows'], $r['skipped'], $r['entries'] ) );

// test_duplicates_keep_first
$r = parse( 'duplicates' );
check( 'test_duplicates_keep_first', array( array( 'weight' => 1, 'entries' => array( '8' ) ), array( 'weight' => 5, 'entries' => array( '7' ) ) ), $r['groups'] );
check( 'test_duplicates_counted', 1, $r['duplicates'] );

// test_invalid_weights_default_to_one + test_groups_by_weight
$r = parse( 'weights' );
check( 'test_invalid_weights_default_to_one', array( 'weight' => 1, 'entries' => array( '1', '2', '3', '4' ) ), $r['groups'][0] );
check( 'test_invalid_weights_counted', 4, $r['invalid_weights'] );
check( 'test_groups_by_weight: lightest first', array( 1, 4 ), array_column( $r['groups'], 'weight' ) );

// Missing file.
check( 'missing file gives the empty result', dvranic_raffle_draw_empty_result(), dvranic_raffle_draw_parse_csv_file( __DIR__ . '/fixtures/nope.csv' ) );

// test_slots_capped_at_entries
check( 'test_slots_capped_at_entries', array( 'A', 'B' ), dvranic_raffle_draw_slot_labels( array( 'A', 'B', 'C' ), 3, 2 ) );

// test_prizes_override_count
check( 'test_prizes_override_count', array( 'Keyboard', 'Ticket' ), dvranic_raffle_draw_slot_labels( array( ' Keyboard ', '', 'Ticket' ), 10, 100 ) );
check( 'no prizes: numbered winners', array( 'Winner 1', 'Winner 2' ), dvranic_raffle_draw_slot_labels( array(), 2, 100 ) );
check( 'no prizes: count clamped to 50', 50, count( dvranic_raffle_draw_slot_labels( array(), 999, 1000 ) ) );
check( 'no prizes: count clamped to at least 1', array( 'Winner 1' ), dvranic_raffle_draw_slot_labels( array(), 0, 1000 ) );

echo "\n{$tests} checks, {$failures} failed\n";
exit( $failures ? 1 : 0 );
