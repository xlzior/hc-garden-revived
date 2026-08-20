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
    _mapHidden: false,

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
        const html = result.status === 'fulfilled' ? result.value : '';
        if (html) {
          const container = document.getElementById('route-' + templateNames[i]);
          if (container) {
            container.innerHTML = html;
            Alpine.initTree(container);
          }
        }
      });

      this.loading = false;
      var mapEl = document.getElementById('route-map');
      Object.assign(mapEl.style, {
        position: 'absolute',
        top: '56px',
        left: '0',
        width: '100%',
        height: 'calc(100vh - 56px - 56px)',
        zIndex: '0'
      });
      var coverEl = document.getElementById('route-map-cover');
      Object.assign(coverEl.style, {
        position: 'absolute',
        top: '56px',
        left: '0',
        width: '100%',
        height: 'calc(100vh - 56px - 56px)',
        background: 'white',
        zIndex: '1',
        transition: 'opacity 0.2s ease'
      });
      this._mapHidden = true;
      this._handleHash();
      window.addEventListener('hashchange', () => this._handleHash());
    },

    _handleHash() {
      const hash = window.location.hash || '#map';
      const parsed = parseRoute(hash);
      this.currentRoute = parsed.screen;
      this.headerTitle = getHeaderTitle(parsed.screen, this);
      this.showFilter = (parsed.screen === 'map' || parsed.screen === 'catalog');
      this._setMapVisible(parsed.screen === 'map' || parsed.screen === 'overview');
      if (parsed.screen === 'overview') {
        this._resolveOverviewParams(parsed);
      }
      if (parsed.screen === 'species') {
        this._resolveSpeciesParams(parsed);
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
      this._setMapVisible(screen === 'map' || screen === 'overview');
      if (params && params.hash) {
        window.history.pushState(null, '', params.hash);
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

    _setMapVisible(visible) {
      var cover = document.getElementById('route-map-cover');
      if (!cover) return;
      if (visible && this._mapHidden) {
        cover.style.opacity = '0';
        cover.style.pointerEvents = 'none';
        this._mapHidden = false;
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('map-visible'));
        });
      } else if (!visible && !this._mapHidden) {
        cover.style.opacity = '1';
        cover.style.pointerEvents = '';
        this._mapHidden = true;
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
