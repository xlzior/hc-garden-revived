// js/components/ff-entry.js
document.addEventListener('alpine:init', () => {
  Alpine.data('ffEntry', () => ({
    lightboxOpen: false,
    lightboxImages: [],
    lightboxIndex: 0,
    imageIndex: 0,
    _swiped: false,

    init() {
      this.$watch('details', () => { this.imageIndex = 0; });
    },

    get details() {
      let d = Alpine.store('app')._routeParams.details;
      if (d && d.name) return d;
      // Fallback: look up from hash-based navigation (e.g. #species/flora-123)
      const hash = window.location.hash;
      const match = hash.match(/#species\/(.+)/);
      if (match) {
        const id = match[1];
        const data = Alpine.store('app').data;
        if (data && data['flora&fauna'] && data['flora&fauna'][id]) {
          return data['flora&fauna'][id];
        }
      }
      return {};
    },

    get name() {
      return this.details.name || '';
    },

    get sciName() {
      return this.details.sciName || '';
    },

    get description() {
      let desc = this.details.description || '';
      return desc.split('\n').join('\n\n');
    },

    get imageRef() {
      return this.details.imageRef || [];
    },

    get images() {
      const ref = this.imageRef;
      if (!ref) return [];
      return Array.isArray(ref) ? ref : [ref];
    },

    get locations() {
      return this.details.locations || '';
    },

    get formattedSciName() {
      return formatSciName(this.sciName);
    },

    get locationList() {
      if (!this.locations) return [];
      const data = Alpine.store('app').data;
      if (!data || !data['map']) return [];
      return this.locations.split(',').map(loc => {
        let [trailId, routeId] = loc.split('/');
        let title = '';
        if (data['map'][trailId] && data['map'][trailId].route && data['map'][trailId].route[routeId]) {
          title = data['map'][trailId].route[routeId].title;
        }
        return { id: loc, title };
      });
    },

    openLightbox(index) {
      this.lightboxImages = Array.isArray(this.imageRef) ? this.imageRef : [this.imageRef];
      this.lightboxIndex = index || 0;
      this.lightboxOpen = true;
    },

    closeLightbox() {
      if (this._swiped) return;
      this.lightboxOpen = false;
    },

    prevImage() {
      if (this.lightboxIndex > 0) this.lightboxIndex--;
    },

    nextImage() {
      if (this.lightboxIndex < this.lightboxImages.length - 1) this.lightboxIndex++;
    },

    _setupSwipe(el, onSwipe) {
      if (!el) return;
      let startX = 0, startY = 0, locked = null, dx = 0;

      const onTouchStart = (e) => {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        locked = null;
        dx = 0;
      };

      const onTouchMove = (e) => {
        const t = e.touches[0];
        const deltaX = t.clientX - startX;
        const deltaY = t.clientY - startY;

        if (!locked && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
          locked = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v';
        }

        if (locked === 'v') return;

        if (locked === 'h') {
          e.preventDefault();
          dx = deltaX;
        }
      };

      const onTouchEnd = () => {
        onSwipe(dx);
        locked = null;
        dx = 0;
      };

      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd, { passive: true });
    },

    initInlineSwipe() {
      this._setupSwipe(this.$refs.inlineImageContainer, (dx) => {
        if (Math.abs(dx) > 50) {
          if (dx < 0 && this.imageIndex < this.images.length - 1) {
            this.imageIndex++;
          } else if (dx > 0 && this.imageIndex > 0) {
            this.imageIndex--;
          }
        }
      });
    },

    initLightboxSwipe() {
      this._setupSwipe(this.$refs.lightboxContainer, (dx) => {
        if (Math.abs(dx) > 50) {
          this._swiped = true;
          if (dx < 0) this.nextImage();
          else if (dx > 0) this.prevImage();
          setTimeout(() => { this._swiped = false; }, 50);
        }
      });
    },

    goToLocation(locationId) {
      Alpine.store('app').navigate('map', { hash: '#map' });
      setTimeout(() => {
        Alpine.store('app').openCallout(locationId);
      }, 100);
    }
  }));
});
