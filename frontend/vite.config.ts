import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
export default defineConfig({
	plugins: [tailwindcss()],
	root: './frontend',
	// build: {
	// 	rollupOptions: {
	// 		external: ['sanitize-html']
	// 	}
	// },
	server: {
		host: '0.0.0.0',
		allowedHosts: true,
		// fs: {
		// 	allow: ['..'], // allow serving files from the parent directory
		// },
	},
});
