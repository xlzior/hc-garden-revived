// js/components/lightbox.js
document.addEventListener('alpine:init', () => {
  Alpine.data('lightbox', () => ({
    open: false,
    images: [],
    currentIndex: 0,

    show(images, index) {
      this.images = images || [];
      this.currentIndex = index || 0;
      this.open = true;
      document.body.style.overflow = 'hidden';
    },

    close() {
      this.open = false;
      document.body.style.overflow = '';
    },

    prev() {
      if (this.currentIndex > 0) this.currentIndex--;
    },

    next() {
      if (this.currentIndex < this.images.length - 1) this.currentIndex++;
    },

    get currentImage() {
      return this.images[this.currentIndex] || '';
    },

    get hasMultiple() {
      return this.images.length > 1;
    }
  }));
});
