// js/app.js — Alpine store, routing, data loading

document.addEventListener('alpine:init', () => {
  Alpine.store('app', {
    data: null,
    loading: true,
    error: null,
    currentRoute: 'home',
    markers: {},
    showFilter: false,
    headerTitle: 'Home',
    filterSettings: { type: { flora: true, fauna: true }, trail: 'all', sortBy: 'alphabetical' },
    _routeParams: {},

    async init() {
      try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        this.data = JSON.parse(text);
        rewriteUrls(this.data);
      } catch (e) {
        console.error('[HC Garden] Init error:', e);
        this.error = 'Failed to load data. Please refresh.';
        return;
      } finally {
        this.loading = false;
      }
      this._handleHash();
      window.addEventListener('hashchange', () => this._handleHash());
    },

    _handleHash() {
      const hash = window.location.hash || '#home';
      const parsed = parseRoute(hash);
      this.currentRoute = parsed.screen;
      this.headerTitle = getHeaderTitle(parsed.screen, this);
      this.showFilter = (parsed.screen === 'map' || parsed.screen === 'flora-fauna');
      if (parsed.screen === 'overview') {
        this._resolveOverviewParams(parsed);
      }
      if (parsed.screen === 'species') {
        this._resolveSpeciesParams(parsed);
      }
      if (parsed.screen === 'map') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('map-visible'));
        }, 100);
      }
    },

    navigate(screen, params) {
      this._routeParams = params || {};
      if (screen === 'species' && params && params.details) {
        this.headerTitle = params.details.name;
      } else if (screen === 'overview' && params && params.title) {
        this.headerTitle = params.title;
      } else {
        this.headerTitle = HEADER_TITLES[screen] || screen;
      }
      this.currentRoute = screen;
      this.showFilter = (screen === 'map' || screen === 'flora-fauna');
      if (params && params.hash) {
        window.history.pushState(null, '', params.hash);
      }
      if (screen === 'map') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('map-visible'));
        }, 100);
      }
    },

    saveMarkers(markers) {
      this.markers = { ...this.markers, ...markers };
    },

    openCallout(locationId) {
      if (this.markers[locationId]) {
        this.markers[locationId].openPopup();
      }
    },

    _resolveOverviewParams(parsed) {
      if (!this.data || !this.data['map']) return;
      const { id } = parsed;
      // id is like "route-01", need to find which trail it belongs to
      for (let trailId in this.data['map']) {
        let trail = this.data['map'][trailId];
        if (trail.route && trail.route[id]) {
          let route = trail.route[id];
          this._routeParams = {
            title: route.title,
            url: route.imageRef,
            points: (route.points || []).map(p => ({
              ...p,
              ...(p.params || {}),
              name: p.params ? p.params.name : undefined
            }))
          };
          this.headerTitle = route.title;
          return;
        }
      }
    },

    _resolveSpeciesParams(parsed) {
      const { id } = parsed;
      if (id && this.data && this.data['flora&fauna'] && this.data['flora&fauna'][id]) {
        this._routeParams = { details: this.data['flora&fauna'][id] };
        this.headerTitle = this.data['flora&fauna'][id].name || '';
      }
    }
  });
});
