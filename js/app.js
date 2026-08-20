// js/app.js — Alpine store + Pinecone route handlers

document.addEventListener('alpine:init', () => {
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '/';
  }

  Alpine.store('app', {
    data: null,
    loading: true,
    error: null,
    showFilter: true,
    headerTitle: 'Map',
    isMapRoute: true,
    filterSettings: { type: { flora: true, fauna: true }, trail: 'all', sortBy: 'alphabetical' },
    markers: {},
    currentDetail: null,
    overviewParams: null,

    async init() {
      try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.data = JSON.parse(await res.text());
      } catch (e) {
        console.error('[HC Garden] Data load error:', e);
        this.error = 'Failed to load data. Please refresh.';
      }
      this.loading = false;
      if (this.isMapRoute) {
        setTimeout(() => window.dispatchEvent(new CustomEvent('map-visible')), 100);
      }
    },

    saveMarkers(markers) {
      this.markers = { ...this.markers, ...markers };
    },

    openCallout(locationId) {
      if (this.markers[locationId]) {
        this.markers[locationId].openPopup();
      }
    }
  });

  Alpine.data('routeHandlers', () => ({
    init() {
      this.$router.settings({ hash: true });
    },

    handleMap() {
      Alpine.store('app').isMapRoute = true;
      Alpine.store('app').headerTitle = 'Map';
      Alpine.store('app').showFilter = true;
      Alpine.store('app').currentDetail = null;
      Alpine.store('app').overviewParams = null;
      setTimeout(() => window.dispatchEvent(new CustomEvent('map-visible')), 100);
    },

    handleOverview(context) {
      const { trailId, routeId } = context.params;
      const data = Alpine.store('app').data;
      Alpine.store('app').isMapRoute = true;
      if (data && data['map'] && data['map'][trailId] && data['map'][trailId].route && data['map'][trailId].route[routeId]) {
        const route = data['map'][trailId].route[routeId];
        Alpine.store('app').overviewParams = {
          title: route.title,
          url: route.imageRef,
          points: (route.points || []).map(p => ({
            ...p,
            ...(p.params || {}),
            name: p.params ? p.params.name : undefined
          }))
        };
        Alpine.store('app').headerTitle = route.title;
      }
      Alpine.store('app').showFilter = false;
      Alpine.store('app').currentDetail = null;
      setTimeout(() => window.dispatchEvent(new CustomEvent('map-visible')), 100);
    },

    handleCatalog() {
      Alpine.store('app').isMapRoute = false;
      Alpine.store('app').headerTitle = 'Catalog';
      Alpine.store('app').showFilter = true;
      Alpine.store('app').currentDetail = null;
      Alpine.store('app').overviewParams = null;
    },

    handleSpecies(context) {
      const { id } = context.params;
      const data = Alpine.store('app').data;
      Alpine.store('app').isMapRoute = false;
      if (id && data && data['flora&fauna'] && data['flora&fauna'][id]) {
        const details = data['flora&fauna'][id];
        Alpine.store('app').headerTitle = details.name || '';
        Alpine.store('app').currentDetail = details;
      }
      Alpine.store('app').showFilter = false;
      Alpine.store('app').overviewParams = null;
    },

    handleNotFound() {
      Alpine.store('app').isMapRoute = true;
      Alpine.store('app').headerTitle = 'Map';
      Alpine.store('app').showFilter = true;
      Alpine.store('app').currentDetail = null;
      Alpine.store('app').overviewParams = null;
      window.location.hash = '/';
    }
  }));
});
