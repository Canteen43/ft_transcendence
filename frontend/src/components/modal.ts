export class Modal {
	private modalElement: HTMLElement;
	private overlayElement: HTMLElement;
	private isOpen: boolean = false;

	constructor(modalId: string) {
		this.modalElement = document.getElementById(modalId)!;
		this.overlayElement =
			this.modalElement.querySelector('.modal-overlay')!;
		this.init();
	}

	private init(): void {
		// Close modal when clicking overlay
		this.overlayElement.addEventListener('click', e => {
			if (e.target === this.overlayElement) {
				this.close();
			}
		});

		// Close modal on escape key
		document.addEventListener('keydown', e => {
			if (e.key === 'Escape' && this.isOpen) {
				this.close();
			}
		});

		// Close button functionality
		const closeButtons =
			this.modalElement.querySelectorAll('[data-modal-close]');
		closeButtons.forEach(button => {
			button.addEventListener('click', () => this.close());
		});
	}

	public open(): void {
		this.isOpen = true;
		this.modalElement.classList.remove('hidden');
		document.body.classList.add('overflow-hidden');

		// Focus trap
		this.modalElement.focus();
	}

	public close(): void {
		this.isOpen = false;
		this.modalElement.classList.add('hidden');
		document.body.classList.remove('overflow-hidden');
	}

	public toggle(): void {
		this.isOpen ? this.close() : this.open();
	}
}

// Example usage and HTML structure
/*
HTML Structure:
<div id="example-modal" class="modal hidden fixed inset-0 z-50" tabindex="-1">
  <div class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-4 border-b">
        <h3 class="text-lg font-semibold text-gray-900">Modal Title</h3>
        <button 
          data-modal-close 
          class="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Modal Body -->
      <div class="p-4">
        <p class="text-gray-600">Your modal content goes here...</p>
      </div>
      
      <!-- Modal Footer -->
      <div class="flex justify-end gap-2 p-4 border-t">
        <button 
          data-modal-close 
          class="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        <button class="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
          Confirm
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Trigger button -->
<button id="open-modal-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  Open Modal
</button>

JavaScript Usage:
const modal = new Modal('example-modal');

// Open modal via button
document.getElementById('open-modal-btn')?.addEventListener('click', () => {
  modal.open();
});

// Or use programmatically
modal.open();   // Opens the modal
modal.close();  // Closes the modal
modal.toggle(); // Toggles modal state
*/
