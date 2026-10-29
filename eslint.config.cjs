/**
 * WordPress's own lint rules, plus one exception: the @wordpress/* packages the editor script
 * imports are provided by WordPress at runtime (wp-scripts turns them into `wp.*` globals), so they
 * are deliberately not installed here.
 */
const wordpress = require( '@wordpress/scripts/config/eslint.config.cjs' );

module.exports = [
	...wordpress,
	{
		settings: {
			'import/core-modules': [
				'@wordpress/api-fetch',
				'@wordpress/block-editor',
				'@wordpress/blocks',
				'@wordpress/components',
				'@wordpress/element',
				'@wordpress/i18n',
				'@wordpress/url',
			],
		},
	},
];
