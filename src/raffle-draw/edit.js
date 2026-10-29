/**
 * Raffle Draw — editor.
 *
 * The sidebar holds every setting; the canvas shows a static preview of the stage so authors can
 * style it with the block's colour, typography and spacing tools. The CSV is never parsed here: the
 * pre-flight route runs the server's parser, so the editor reports exactly what the stage will draw.
 */

import { __, _n, sprintf } from '@wordpress/i18n';
import {
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	useBlockProps,
} from '@wordpress/block-editor';
import {
	Button,
	Notice,
	PanelBody,
	RangeControl,
	Spinner,
	TextControl,
	Flex,
	FlexBlock,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

const CSV_TYPES = [ 'text/csv' ];

/**
 * Ask the server what it reads in the chosen CSV.
 *
 * @param {number} csvId Attachment ID, 0 for none.
 * @return {{report: Object|null, error: string, loading: boolean}} Pre-flight state.
 */
function usePreflight( csvId ) {
	const [ state, setState ] = useState( {
		report: null,
		error: '',
		loading: false,
	} );

	useEffect( () => {
		if ( ! csvId ) {
			setState( { report: null, error: '', loading: false } );
			return;
		}

		let cancelled = false;
		setState( { report: null, error: '', loading: true } );

		apiFetch( {
			path: addQueryArgs( '/raffle-draw/v1/preflight', {
				attachment: csvId,
			} ),
		} )
			.then( ( report ) => {
				if ( ! cancelled ) {
					setState( { report, error: '', loading: false } );
				}
			} )
			.catch( ( error ) => {
				if ( ! cancelled ) {
					setState( {
						report: null,
						error:
							error?.message ||
							__( 'Could not read the file.', 'raffle-draw' ),
						loading: false,
					} );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ csvId ] );

	return state;
}

function PreflightReport( { report, error, loading } ) {
	if ( loading ) {
		return <Spinner />;
	}

	if ( error ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ error }
			</Notice>
		);
	}

	if ( ! report ) {
		return null;
	}

	if ( ! report.entries ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ __(
					'No ticket numbers found. Column 1 must hold 1–12 digits.',
					'raffle-draw'
				) }
			</Notice>
		);
	}

	const weighted =
		report.weights.length > 1 || report.weights[ 0 ]?.weight > 1;

	const warnings = [
		report.skipped &&
			sprintf(
				/* translators: %d: number of rows. */
				_n(
					'%d row skipped: the ticket number is not 1–12 digits.',
					'%d rows skipped: the ticket number is not 1–12 digits.',
					report.skipped,
					'raffle-draw'
				),
				report.skipped
			),
		report.duplicates &&
			sprintf(
				/* translators: %d: number of rows. */
				_n(
					'%d duplicate number ignored (the first one counts).',
					'%d duplicate numbers ignored (the first one counts).',
					report.duplicates,
					'raffle-draw'
				),
				report.duplicates
			),
		report.invalid_weights &&
			sprintf(
				/* translators: %d: number of rows. */
				_n(
					'%d weight was not a whole number of 1 or more and counts as 1.',
					'%d weights were not whole numbers of 1 or more and count as 1.',
					report.invalid_weights,
					'raffle-draw'
				),
				report.invalid_weights
			),
	].filter( Boolean );

	return (
		<>
			<Notice status="success" isDismissible={ false }>
				{ sprintf(
					/* translators: 1: number of tickets, 2: number of digits. */
					_n(
						'%1$d ticket ready, %2$d digits.',
						'%1$d tickets ready, %2$d digits.',
						report.entries,
						'raffle-draw'
					),
					report.entries,
					report.digits
				) }
				{ weighted &&
					' ' +
						report.weights
							.map( ( { weight, count } ) =>
								sprintf(
									/* translators: 1: how many tickets, 2: their weight. */
									__( '%1$d × weight %2$d', 'raffle-draw' ),
									count,
									weight
								)
							)
							.join( ', ' ) }
			</Notice>
			{ warnings.map( ( warning ) => (
				<Notice
					key={ warning }
					status="warning"
					isDismissible={ false }
				>
					{ warning }
				</Notice>
			) ) }
		</>
	);
}

function PrizeList( { prizes, onChange } ) {
	const update = ( index, value ) =>
		onChange(
			prizes.map( ( prize, i ) => ( i === index ? value : prize ) )
		);

	const move = ( index, by ) => {
		const next = [ ...prizes ];
		[ next[ index ], next[ index + by ] ] = [
			next[ index + by ],
			next[ index ],
		];
		onChange( next );
	};

	return (
		<>
			<p>
				{ __(
					'One winner per prize, drawn top to bottom. Put the grand prize last for suspense.',
					'raffle-draw'
				) }
			</p>
			{ prizes.map( ( prize, index ) => (
				<Flex key={ index } align="flex-end">
					<FlexBlock>
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ sprintf(
								/* translators: %d: prize position. */
								__( 'Prize %d', 'raffle-draw' ),
								index + 1
							) }
							value={ prize }
							onChange={ ( value ) => update( index, value ) }
						/>
					</FlexBlock>
					<Button
						icon="arrow-up-alt2"
						label={ __( 'Move up', 'raffle-draw' ) }
						disabled={ index === 0 }
						onClick={ () => move( index, -1 ) }
						size="small"
					/>
					<Button
						icon="arrow-down-alt2"
						label={ __( 'Move down', 'raffle-draw' ) }
						disabled={ index === prizes.length - 1 }
						onClick={ () => move( index, 1 ) }
						size="small"
					/>
					<Button
						icon="no-alt"
						label={ __( 'Remove prize', 'raffle-draw' ) }
						onClick={ () =>
							onChange(
								prizes.filter( ( _p, i ) => i !== index )
							)
						}
						size="small"
					/>
				</Flex>
			) ) }
			<Button
				variant="secondary"
				onClick={ () => onChange( [ ...prizes, '' ] ) }
				style={ { marginTop: '12px' } }
			>
				{ __( 'Add prize', 'raffle-draw' ) }
			</Button>
		</>
	);
}

export default function Edit( { attributes, setAttributes } ) {
	const {
		csvId,
		csvName,
		prizes,
		winnersCount,
		headline,
		bgImageId,
		bgImageUrl,
		dimRatio,
	} = attributes;

	const preflight = usePreflight( csvId );
	const digits = preflight.report?.digits || 4;

	const named = prizes.map( ( prize ) => prize.trim() ).filter( Boolean );
	const slots = named.length
		? named
		: Array.from( { length: winnersCount }, ( _v, i ) =>
				sprintf(
					/* translators: %d: position of the winner, starting at 1. */
					__( 'Winner %d', 'raffle-draw' ),
					i + 1
				)
			);

	const blockProps = useBlockProps( {
		className: bgImageUrl ? 'has-background-image' : undefined,
		style: {
			'--raffle-draw-digits': digits,
			'--raffle-draw-dim': dimRatio / 100,
		},
	} );

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Tickets (CSV)', 'raffle-draw' ) }>
					<p>
						{ __(
							'Column 1: ticket number (up to 12 digits, leading zeros are kept). Optional column 2: weight, a whole number — 5 means five times the chance. No weight column means everyone has the same chance.',
							'raffle-draw'
						) }
					</p>
					<MediaUploadCheck>
						<MediaUpload
							allowedTypes={ CSV_TYPES }
							value={ csvId }
							onSelect={ ( media ) =>
								setAttributes( {
									csvId: media.id,
									csvName:
										media.filename || media.title || '',
								} )
							}
							render={ ( { open } ) => (
								<Button variant="secondary" onClick={ open }>
									{ csvId
										? __( 'Replace CSV', 'raffle-draw' )
										: __( 'Choose CSV', 'raffle-draw' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
					{ csvName && (
						<p>
							<code>{ csvName }</code>
						</p>
					) }
					<PreflightReport { ...preflight } />
				</PanelBody>

				<PanelBody title={ __( 'Prizes', 'raffle-draw' ) }>
					<PrizeList
						prizes={ prizes }
						onChange={ ( value ) =>
							setAttributes( { prizes: value } )
						}
					/>
				</PanelBody>

				<PanelBody
					title={ __( 'Draw', 'raffle-draw' ) }
					initialOpen={ false }
				>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Headline', 'raffle-draw' ) }
						value={ headline }
						onChange={ ( value ) =>
							setAttributes( { headline: value } )
						}
					/>
					{ ! named.length && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Number of winners', 'raffle-draw' ) }
							help={ __(
								'Used when no prizes are listed.',
								'raffle-draw'
							) }
							min={ 1 }
							max={ 50 }
							value={ winnersCount }
							onChange={ ( value ) =>
								setAttributes( { winnersCount: value ?? 3 } )
							}
						/>
					) }
				</PanelBody>

				<PanelBody
					title={ __( 'Background image', 'raffle-draw' ) }
					initialOpen={ false }
				>
					<MediaUploadCheck>
						<MediaUpload
							allowedTypes={ [ 'image' ] }
							value={ bgImageId }
							onSelect={ ( media ) =>
								setAttributes( {
									bgImageId: media.id,
									bgImageUrl: media.url,
								} )
							}
							render={ ( { open } ) => (
								<Button variant="secondary" onClick={ open }>
									{ bgImageId
										? __( 'Replace image', 'raffle-draw' )
										: __( 'Choose image', 'raffle-draw' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
					{ !! bgImageId && (
						<>
							<Button
								variant="link"
								isDestructive
								onClick={ () =>
									setAttributes( {
										bgImageId: 0,
										bgImageUrl: '',
									} )
								}
								style={ { marginInlineStart: '12px' } }
							>
								{ __( 'Remove', 'raffle-draw' ) }
							</Button>
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Overlay opacity', 'raffle-draw' ) }
								min={ 0 }
								max={ 100 }
								step={ 10 }
								value={ dimRatio }
								onChange={ ( value ) =>
									setAttributes( { dimRatio: value ?? 50 } )
								}
							/>
						</>
					) }
				</PanelBody>
			</InspectorControls>

			<section { ...blockProps }>
				{ bgImageUrl && (
					<div className="raffle-draw__background" aria-hidden="true">
						<img
							className="raffle-draw__background-image"
							src={ bgImageUrl }
							alt=""
						/>
						<span className="raffle-draw__overlay" />
					</div>
				) }

				<div className="raffle-draw__stage">
					{ headline && (
						<h2 className="raffle-draw__headline">{ headline }</h2>
					) }

					<p className="raffle-draw__now">
						<span className="raffle-draw__now-label">
							{ __( 'Now drawing', 'raffle-draw' ) }
						</span>
						<strong className="raffle-draw__now-prize">
							{ slots[ 0 ] }
						</strong>
					</p>

					<div className="raffle-draw__reels" aria-hidden="true">
						{ Array.from( { length: digits }, ( _v, reel ) => (
							<div className="raffle-draw__reel" key={ reel }>
								<div className="raffle-draw__strip">
									<span className="raffle-draw__digit">
										0
									</span>
								</div>
							</div>
						) ) }
					</div>

					<div className="wp-block-button raffle-draw__actions">
						<span className="wp-block-button__link wp-element-button raffle-draw__draw">
							{ __( 'Draw', 'raffle-draw' ) }
						</span>
					</div>

					<ol className="raffle-draw__winners">
						{ slots.map( ( label, slot ) => (
							<li className="raffle-draw__winner" key={ slot }>
								<span className="raffle-draw__winner-label">
									{ label }
								</span>
								<span className="raffle-draw__winner-number" />
							</li>
						) ) }
					</ol>

					{ ! csvId && (
						<Notice status="info" isDismissible={ false }>
							{ __(
								'Choose a CSV of ticket numbers in the block settings to make this stage live.',
								'raffle-draw'
							) }
						</Notice>
					) }
				</div>
			</section>
		</>
	);
}
