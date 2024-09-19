import js from 'eslint-config-janus/js.js'
import node from 'eslint-config-janus/node.js'
import stylisticJs from '@stylistic/eslint-plugin-js'

export default [
	...js,
	...node,
	{
		name: 'config.mjs',
		files: ['*.mjs'],
		languageOptions: {
			sourceType: 'module',
		},
	},
	{
		plugins: {
			'@stylistic/js': stylisticJs,
		},
		languageOptions: {
			globals: {
				vscode: 'readonly',
				workspace: 'readonly',
				utils: 'readonly',
				lastLine: 'writable',
				lastDecor: 'writable',
				maxSmallIntegerV8: 'writable',
				setTimeout: 'readonly',
				console: 'readonly',
			},
			parserOptions: {
				sourceType: 'module',
			},
		},
		rules: {
			'no-undef': 2,

		},
	},
]
