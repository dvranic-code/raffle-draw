/**
 * Raffle Draw — block registration. Settings come from block.json; the front end is render.php.
 */

import { registerBlockType } from '@wordpress/blocks';

import Edit from './edit';
import metadata from './block.json';
import './style.scss';
import './editor.scss';

registerBlockType( metadata.name, {
	edit: Edit,
	// Dynamic block: render.php draws the front end, so nothing is saved into post content.
	save: () => null,
} );
