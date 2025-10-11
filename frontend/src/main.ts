// ============================================
// MAIN THREAD PROFILER - Add to TOP of main.ts
// ============================================

console.log('🔍 PROFILER: Script execution started');
console.time('⏱️ TOTAL SCRIPT EXECUTION');

// Track long tasks on main thread
let taskStartTime = performance.now();
const LONG_TASK_THRESHOLD = 50; // ms

// Intercept all setTimeout/setInterval/requestAnimationFrame
const originalSetTimeout = window.setTimeout;
const originalSetInterval = window.setInterval;
const originalRAF = window.requestAnimationFrame;

window.setTimeout = function(callback: TimerHandler, delay?: number, ...args: any[]) {
	const wrappedCallback = function(this: any) {
		const start = performance.now();
		try {
			if (typeof callback === 'function') {
				callback.apply(this, args);
			} else {
				// Handle string callbacks (eval)
				eval(callback);
			}
		} finally {
			const duration = performance.now() - start;
			if (duration > LONG_TASK_THRESHOLD) {
				const callbackStr = typeof callback === 'function' ? callback.toString().substring(0, 100) : callback;
				console.warn(`⚠️ LONG setTimeout TASK: ${duration.toFixed(2)}ms`, callbackStr);
			}
		}
	};
	return originalSetTimeout.call(window, wrappedCallback, delay);
} as any;

window.setInterval = function(callback: TimerHandler, delay?: number, ...args: any[]) {
	const wrappedCallback = function(this: any) {
		const start = performance.now();
		try {
			if (typeof callback === 'function') {
				callback.apply(this, args);
			} else {
				// Handle string callbacks (eval)
				eval(callback);
			}
		} finally {
			const duration = performance.now() - start;
			if (duration > LONG_TASK_THRESHOLD) {
				const callbackStr = typeof callback === 'function' ? callback.toString().substring(0, 100) : callback;
				console.warn(`⚠️ LONG setInterval TASK: ${duration.toFixed(2)}ms`, callbackStr);
			}
		}
	};
	return originalSetInterval.call(window, wrappedCallback, delay);
} as any;

window.requestAnimationFrame = function(callback: FrameRequestCallback) {
	const wrappedCallback = function(time: number) {
		const start = performance.now();
		try {
			callback(time);
		} finally {
			const duration = performance.now() - start;
			if (duration > LONG_TASK_THRESHOLD) {
				console.warn(`⚠️ LONG RAF TASK: ${duration.toFixed(2)}ms`);
			}
		}
	};
	return originalRAF.call(window, wrappedCallback);
};

// Track module imports
const moduleLoadTimes = new Map<string, number>();

// Performance observer for long tasks
if ('PerformanceObserver' in window) {
	try {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.duration > LONG_TASK_THRESHOLD) {
					console.warn(`⚠️ LONG TASK DETECTED: ${entry.duration.toFixed(2)}ms`, entry);
				}
			}
		});
		observer.observe({ entryTypes: ['longtask', 'measure'] });
	} catch (e) {
		console.log('PerformanceObserver not fully supported');
	}
}

// Track when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	console.log('✅ DOMContentLoaded fired');
	console.timeLog('⏱️ TOTAL SCRIPT EXECUTION');
});

window.addEventListener('load', () => {
	console.log('✅ window.load fired');
	console.timeEnd('⏱️ TOTAL SCRIPT EXECUTION');
	
	// Report all performance metrics
	const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
	if (perfData) {
		console.group('📊 Navigation Timing Breakdown');
		console.log(`DNS Lookup: ${(perfData.domainLookupEnd - perfData.domainLookupStart).toFixed(2)}ms`);
		console.log(`TCP Connection: ${(perfData.connectEnd - perfData.connectStart).toFixed(2)}ms`);
		console.log(`Request: ${(perfData.responseStart - perfData.requestStart).toFixed(2)}ms`);
		console.log(`Response: ${(perfData.responseEnd - perfData.responseStart).toFixed(2)}ms`);
		console.log(`DOM Processing: ${(perfData.domComplete - perfData.domInteractive).toFixed(2)}ms`);
		console.log(`DOM Interactive: ${(perfData.domInteractive - perfData.fetchStart).toFixed(2)}ms`);
		console.log(`Load Event: ${(perfData.loadEventEnd - perfData.loadEventStart).toFixed(2)}ms`);
		console.groupEnd();
	}
});

// Track beforeunload (page leaving)
window.addEventListener('beforeunload', () => {
	console.log('🚪 Page unloading...');
	console.time('🧹 Cleanup Time');
});

// Expose profiler utilities
(window as any).profiler = {
	getLongTasks: () => {
		return performance.getEntriesByType('longtask');
	},
	getResourceTiming: () => {
		return performance.getEntriesByType('resource').map(r => ({
			name: r.name,
			duration: r.duration,
			size: (r as any).transferSize || 0
		})).sort((a, b) => b.duration - a.duration);
	},
	clearMarks: () => {
		performance.clearMarks();
		performance.clearMeasures();
	}
};

console.log('🔍 PROFILER: Initialized. Use window.profiler for utilities');

// ============================================
// NOW YOUR NORMAL main.ts CODE CONTINUES...
// ============================================

import { AuthComponent } from './buttons/AuthButton';
import { ChatManager } from './utils/Chat';
import { router } from './utils/Router';
import { state } from './utils/State';
import { webSocket } from './utils/WebSocketWrapper';
import { getEndpoints } from './utils/endpoints';

// Register Babylon glTF loaders (side-effect import). Ensure '@babylonjs/loaders' is installed.
import '@babylonjs/loaders';
import './style.css';

// Global exposure for debugging
(window as any).state = state;
(window as any).webSocket = webSocket;

window.addEventListener('error', event => {
	console.error('Unhandled error', event.error);
});
window.addEventListener('unhandledrejection', event => {
	console.error('Unhandled promise rejection', event.reason);
});

const app = document.getElementById('app') as HTMLDivElement;
app.className = 'w-screen h-screen flex flex-col bg-white bg-center';
app.style.backgroundSize = 'cover';
app.style.backgroundPosition = 'center';
app.style.backgroundRepeat = 'no-repeat';

async function initApp() {
	try {
		await getEndpoints();

		router.init();

		new AuthComponent(app);
		new ChatManager(app); 

		console.log('App initialized');
	} catch (error) {
		console.error('Failed to initialize app:', error);
	}
}

initApp();
