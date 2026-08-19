// js/app.js — Alpine store, routing, data loading

document.addEventListener('alpine:init', () => {
  Alpine.store('app', {
    data: null,
    loading: true,
    error: null,
    currentRoute: 'map',
    markers: {},
    showFilter: false,
    headerTitle: 'Map',
    filterSettings: { type: { flora: true, fauna: true }, trail: 'all', sortBy: 'alphabetical' },
    _routeParams: {},
    _templates: {},

    async init() {
      const templateNames = [
        'map', 'overview', 'catalog', 'species', 'history', 'info'
      ];

      const [dataRes, ...tplResults] = await Promise.allSettled([
        fetch('data.json'),
        ...templateNames.map(name =>
          fetch('templates/' + name + '.html').then(function(r) {
            if (!r.ok) throw new Error('Template ' + name + ': HTTP ' + r.status);
            return r.text();
          })
        )
      ]);

      if (dataRes.status === 'fulfilled' && dataRes.value.ok) {
        try {
          var text = await dataRes.value.text();
          this.data = JSON.parse(text);
        } catch (e) {
          console.error('[HC Garden] Data parse error:', e);
          this.error = 'Failed to load data. Please refresh.';
          this.loading = false;
          return;
        }
      } else {
        console.error('[HC Garden] Init error:', dataRes.reason || dataRes.value);
        this.error = 'Failed to load data. Please refresh.';
        this.loading = false;
        return;
      }

      tplResults.forEach(function(result, i) {
        this._templates[templateNames[i]] =
          result.status === 'fulfilled' ? result.value : '';
      }.bind(this));

      this.loading = false;
      this._handleHash();
      window.addEventListener('hashchange', () => this._handleHash());
    },

    _handleHash() {
      const hash = window.location.hash || '#map';
      const parsed = parseRoute(hash);
      this.currentRoute = parsed.screen;
      this.headerTitle = getHeaderTitle(parsed.screen, this);
      this.showFilter = (parsed.screen === 'map' || parsed.screen === 'catalog');
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
      this.showFilter = (screen === 'map' || screen === 'catalog');
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
      const { trailId, routeId } = parsed;
      const trail = this.data['map'][trailId];
      if (trail && trail.route && trail.route[routeId]) {
        let route = trail.route[routeId];
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
