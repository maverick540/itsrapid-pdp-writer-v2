import adapter from '@sveltejs/adapter-static';  

/** @type {import('@sveltejs/kit').Config} */  
const config = {  
	kit: {  
		// Use the static adapter for GitHub Pages  
		adapter: adapter({  
			pages: 'build', // Output directory for the built files  
			assets: 'build', // Directory for static assets  
			fallback: null, // '200.html' // Set to '200.html' if you are using client-side routing  
			strict: false
		}),  
		// Specify the base path for GitHub Pages  
		paths: {  
			base: '/itsrapid-pdp-writer-v2' // Replace with your GitHub repository name  
		}  
	}  
};  

export default config;  