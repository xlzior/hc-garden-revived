// js/components/ff-list.js
document.addEventListener('alpine:init', () => {
  Alpine.data('ffList', () => ({
    searchTerm: '',
    activeType: 'all',
    trail: 'all',
    sortBy: 'alphabetical',
    flora: [],
    fauna: [],
    initialized: false,

    get type() {
      if (this.activeType === 'flora') return { flora: true, fauna: false };
      if (this.activeType === 'fauna') return { flora: false, fauna: true };
      return { flora: true, fauna: true };
    },

    set type(val) {
      if (val.flora && val.fauna) this.activeType = 'all';
      else if (val.flora) this.activeType = 'flora';
      else if (val.fauna) this.activeType = 'fauna';
    },

    init() {
      this._startWatchingLocation();
      window.addEventListener('filter-changed', (e) => {
        this.type = e.detail.type;
        this.trail = e.detail.trail;
        this.sortBy = e.detail.sortBy;
      });
      this.$watch('$store.app.data', () => {
        if (Alpine.store('app').data && !this.initialized) {
          this.initialized = true;
          this._buildLists();
        }
      });
      if (Alpine.store('app').data) {
        this.initialized = true;
        this._buildLists();
      }
    },

    _buildLists() {
      const data = Alpine.store('app').data;
      if (!data || !data['flora&fauna']) return;
      const ffData = data['flora&fauna'];
      const mapData = data['map'];
      let flora = [], fauna = [];
      for (let entry in ffData) {
        let details = ffData[entry];
        let distance = 9999;
        let uLat = window._userLat, uLon = window._userLon;
        if (uLat && uLon && details.locations) {
          let distances = details.locations.split(',').map(id => {
            let [trailId, routeId] = id.split('/');
            if (mapData[trailId] && mapData[trailId].route && mapData[trailId].route[routeId]) {
              let { latitude, longitude } = mapData[trailId].route[routeId];
              return haversineDistance(latitude, longitude, uLat, uLon) * 1000;
            }
            return 9999;
          });
          distance = Math.min(...distances);
        }
        let item = { id: entry, ...details, distance };
        if (entry.startsWith('flora-')) flora.push(item);
        else if (entry.startsWith('fauna-')) fauna.push(item);
      }
      this.flora = flora;
      this.fauna = fauna;
    },

    _startWatchingLocation() {
      if (!navigator.geolocation) return;
      navigator.geolocation.watchPosition(
        (pos) => {
          window._userLat = pos.coords.latitude;
          window._userLon = pos.coords.longitude;
          this._buildLists();
        },
        () => {},
        { enableHighAccuracy: true }
      );
    },

    setActiveType(type) {
      this.activeType = type;
    },

    clearSearch() {
      this.searchTerm = '';
    },

    isSearched(details) {
      let search = this.searchTerm.toLowerCase();
      if (!search) return true;
      let name = details.name || '';
      let sciName = details.sciName || '';
      let locations = details.locations || '';
      return name.toLowerCase().includes(search) ||
             sciName.toLowerCase().includes(search) ||
             locations.toLowerCase().includes(search);
    },

    isFiltered(details) {
      let id = details.id || '';
      if (id.startsWith('flora-') && !this.type.flora) return true;
      if (id.startsWith('fauna-') && !this.type.fauna) return true;
      if (this.trail !== 'all') {
        if (!details.locations || !details.locations.includes(this.trail)) return true;
      }
      return false;
    },

    getDisplayList(items) {
      let filtered = items.filter(d => this.isSearched(d) && !this.isFiltered(d));
      if (this.sortBy === 'distance') {
        filtered.sort((a, b) => a.distance - b.distance);
      } else {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      return filtered;
    },

    getImageSrc(imageRef) {
      if (!imageRef) return '';
      if (Array.isArray(imageRef)) return imageRef[0] || '';
      return imageRef;
    },

    getFaunaDisplay() {
      return this.getDisplayList(this.fauna);
    },

    getFloraDisplay() {
      return this.getDisplayList(this.flora);
    },

    viewSpecies(details) {
      Alpine.store('app').currentDetail = details;
      Alpine.store('app').headerTitle = details.name || '';
      this.$router.navigate('/species/' + details.id);
    },

    openFilterModal() {
      window.dispatchEvent(new CustomEvent('open-filter-modal'));
    }
  }));
});
