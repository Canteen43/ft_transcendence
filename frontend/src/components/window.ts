// window.ts
export class AppWindow {
  private overlay: HTMLDivElement;
  private container: HTMLDivElement;

  constructor(content: HTMLElement | string) {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = `
      fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center
      z-50
    `;

    // Container
    this.container = document.createElement('div');
    this.container.className = `
      bg-white w-4/5 h-4/5 rounded-lg p-4 relative flex flex-col
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.className = `
      absolute top-2 right-2 text-xl font-bold
    `;
    closeBtn.addEventListener('click', () => this.close());

    this.container.appendChild(closeBtn);

    // Insert content
    if (typeof content === 'string') {
      this.container.innerHTML += content;
    } else {
      this.container.appendChild(content);
    }

    this.overlay.appendChild(this.container);

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  open() {
    document.body.appendChild(this.overlay);
  }

  close() {
    this.overlay.remove();
  }
}
