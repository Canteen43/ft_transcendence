import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
export default defineConfig({
	plugins: [tailwindcss()],
	root: './frontend',
	// server: {
	// 	fs: {
	// 		allow: ['..'], // allow serving files from the parent directory
	// 	},
	// },
});
