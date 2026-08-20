// js/components/ff-entry.js
document.addEventListener('alpine:init', () => {
  Alpine.data('ffEntry', () => ({
    lightboxOpen: false,
    lightboxImages: [],
    lightboxIndex: 0,

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
      this.lightboxOpen = false;
    },

    prevImage() {
      if (this.lightboxIndex > 0) this.lightboxIndex--;
    },

    nextImage() {
      if (this.lightboxIndex < this.lightboxImages.length - 1) this.lightboxIndex++;
    },

    goToLocation(locationId) {
      Alpine.store('app').navigate('map', { hash: '#map' });
      setTimeout(() => {
        Alpine.store('app').openCallout(locationId);
      }, 100);
    }
  }));
});
