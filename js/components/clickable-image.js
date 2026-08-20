// js/components/clickable-image.js
document.addEventListener('alpine:init', () => {
  Alpine.data('clickableImage', () => ({
    imageLoaded: false,
    imageWidth: 0,
    imageHeight: 0,
    _lastUrl: '',
    _imgEl: null,
    imageBoundsStyle: {},

    get params() {
      return Alpine.store('app')._routeParams || {};
    },

    get title() {
      return this.params.title || '';
    },

    get imageUrl() {
      return this.params.url || '';
    },

    get points() {
      return this.params.points || [];
    },

    init() {
      this.$watch('imageUrl', (url) => {
        if (url && url !== this._lastUrl) {
          this._lastUrl = url;
          this.imageLoaded = false;
          this.imageWidth = 0;
          this.imageHeight = 0;
          this.imageBoundsStyle = {};
        }
      });
    },

    onImageLoad(e) {
      this._imgEl = e.target;
      this._computeImageBounds();
      const ro = new ResizeObserver(() => this._computeImageBounds());
      ro.observe(this.$refs.overviewContainer);
    },

    _computeImageBounds() {
      if (!this._imgEl || !this.$refs.overviewContainer) return;
      const cw = this.$refs.overviewContainer.offsetWidth;
      const ch = this.$refs.overviewContainer.offsetHeight;
      const nw = this._imgEl.naturalWidth;
      const nh = this._imgEl.naturalHeight;
      if (!nw || !nh) return;
      const scale = Math.min(cw / nw, ch / nh);
      const w = nw * scale;
      const h = nh * scale;
      this.imageWidth = w;
      this.imageHeight = h;
      this.imageBoundsStyle = {
        width: w + 'px',
        height: h + 'px',
        top: ((ch - h) / 2) + 'px',
        left: ((cw - w) / 2) + 'px'
      };
      this.imageLoaded = true;
    },

    getDetails(pointName) {
      const data = Alpine.store('app').data;
      if (!data || !data['flora&fauna']) return null;
      return getFFEntryDetails(pointName, data['flora&fauna']);
    },

    viewSpecies(pointName) {
      let details = this.getDetails(pointName);
      if (!details) return;
      Alpine.store('app').navigate('species', '#species/' + pointName);
    },

    getHotspotStyle(point) {
      let layoutHeight = this.imageHeight || 1;
      let layoutWidth = this.imageWidth || 1;
      let top = point.top * layoutHeight - point.size / 2;
      let left = point.left * layoutWidth - point.size / 2;
      return {
        position: 'absolute',
        top: top + 'px',
        left: left + 'px',
        width: point.size + 'px',
        height: point.size + 'px'
      };
    },

    getFloraHotspotStyle(point) {
      let layoutHeight = this.imageHeight || 1;
      let layoutWidth = this.imageWidth || 1;
      let top = point.top * layoutHeight - point.size / 2;
      let left = point.left * layoutWidth - point.size / 2;
      return {
        position: 'absolute',
        top: top + 'px',
        left: left + 'px',
        width: point.size + 'px',
        height: point.size + 'px',
        border: '3px solid gold',
        borderRadius: '50%',
        animation: 'pulse-ring 2s ease-in-out infinite'
      };
    }
  }));
});
