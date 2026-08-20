// js/map.js — Leaflet map implementation

document.addEventListener('alpine:init', () => {
  Alpine.data('mapLegend', () => ({
    init() {
      window.addEventListener('map-visible', () => {
        const data = Alpine.store('app').data;
        if (data && !this._map) this._initMap();
        if (this._map) {
          requestAnimationFrame(() => {
            this._map.invalidateSize();
          });
        }
      });

      window.addEventListener('filter-changed', (e) => {
        this._type = e.detail.type;
        this._trail = e.detail.trail;
        if (this._map) this._updateVisibility();
      });
    },

    _initMap() {
      const data = Alpine.store('app').data;
      if (!data || !data['map']) return;
      if (this._map) return;

      const mapEl = document.getElementById('route-map');
      if (!mapEl) return;

      this._map = L.map('route-map', {
        center: [1.326212, 103.805252],
        zoom: 16,
        minZoom: 15,
        maxZoom: 20
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this._map);

      L.imageOverlay('assets/maps/map_all.png', [[1.328214, 103.800920], [1.324215, 103.807922]]).addTo(this._map);

      this._trailMarkers = {};
      this._birdMarkers = {};
      this._polygons = {};
      this._showBird = null;
      this._type = { flora: true, fauna: true };
      this._trail = 'all';

      this._renderTrails(data);
      this._renderBirds(data);
      this._renderLegend(data);

      setTimeout(() => this._map.invalidateSize(), 100);
    },

    _renderTrails(data) {
      const mapData = data['map'];
      for (let trailId in mapData) {
        let trail = mapData[trailId];
        if (!trail.route) continue;
        trail.markers = [];
        for (let routeId in trail.route) {
          let route = trail.route[routeId];
          let { title, latitude, longitude, imageRef } = route;
          if (!latitude || !longitude) continue;

          let thumbUrl = imageRef || '';
          let marker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: 'trail-marker',
              html: `<div style="background:${trail.color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })
          }).addTo(this._map);

          let popupContent = `<div style="min-width:120px;max-width:180px;text-align:center;cursor:pointer;" onclick="document.dispatchEvent(new CustomEvent('trail-callout-press',{detail:'${trailId}/${routeId}'}))">
            <div style="font-size:14px;margin-bottom:4px;">${title}</div>
            ${thumbUrl ? `<img src="${thumbUrl}" style="width:100%;height:80px;object-fit:cover;border-radius:4px;" onerror="this.style.display='none'">` : ''}
          </div>`;

          marker.bindPopup(popupContent);

          let locKey = trailId + '/' + routeId;
          marker._locationKey = locKey;
          marker._trailId = trailId;
          this._trailMarkers[locKey] = marker;
          trail.markers.push(locKey);
        }
      }

      document.addEventListener('trail-callout-press', (e) => {
        const locKey = e.detail;
        const [trailId, routeId] = locKey.split('/');
        const data = Alpine.store('app').data;
        const route = data['map'][trailId]?.route[routeId];
        if (!route) return;
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
        window.location.hash = '/map/overview/' + trailId + '/' + routeId;
      });
    },

    _renderBirds(data) {
      const ffData = data['flora&fauna'];
      if (!ffData) return;
      for (let id in ffData) {
        if (!id.startsWith('fauna-')) continue;
        let details = ffData[id];
        let { name, latitude, longitude, area, imageRef } = details;
        if (!latitude || !longitude) continue;

        let birdImg = Array.isArray(imageRef) ? imageRef[0] : imageRef;

        let marker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: 'bird-marker',
            html: `<div style="width:44px;height:44px;border-radius:50%;border:2px solid white;background:lightgrey;overflow:hidden;cursor:pointer;">
              <img src="${birdImg || ''}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'">
            </div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          })
        }).addTo(this._map);

        marker._birdId = id;
        this._birdMarkers[id] = marker;

        marker.bindTooltip(name, { permanent: false, direction: 'top', offset: [0, -22] });

        marker.on('click', () => {
          if (this._showBird === id) {
            this._showBird = null;
            if (this._polygons[id]) this._polygons[id].remove();
            this._map.closePopup();
          } else {
            if (this._showBird && this._polygons[this._showBird]) {
              this._polygons[this._showBird].remove();
            }
            this._showBird = id;
            if (this._polygons[id]) this._polygons[id].addTo(this._map);
            this._map.closePopup();
          }
        });

        if (area && area.length > 0) {
          let latlngs = area.map(p => [p.latitude || p.lat, p.longitude || p.lng || p.lon]);
          let polygon = L.polygon(latlngs, {
            fillColor: '#0000FF',
            fillOpacity: 0.12,
            color: '#0000FF',
            opacity: 0.12,
            weight: 3
          });
          polygon._birdId = id;
          polygon.on('click', () => {
            Alpine.store('app').currentDetail = details;
            Alpine.store('app').headerTitle = details.name || '';
            window.location.hash = '/species/' + id;
          });
          this._polygons[id] = polygon;
        }
      }
    },

    _renderLegend(data) {
      const mapData = data['map'];
      const legendEl = document.getElementById('map-legend');
      if (!legendEl) return;

      let html = '';
      for (let trailId in mapData) {
        let trail = mapData[trailId];
        if (!trail.name || !trail.color) continue;
        html += `<div class="flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 rounded" data-trail-id="${trailId}">
          <div class="w-5 h-5 rounded-full mr-3 flex-shrink-0" style="background:${trail.color};"></div>
          <span class="flex-1 text-sm text-gray-700">${trail.name}</span>
          <span class="material-icons text-gray-400 text-lg">chevron_right</span>
        </div>`;
      }
      legendEl.innerHTML = html;

      legendEl.querySelectorAll('[data-trail-id]').forEach(el => {
        el.addEventListener('click', () => {
          let trailId = el.dataset.trailId;
          let trail = mapData[trailId];
          if (trail && trail.markers && trail.markers.length > 0) {
            let bounds = trail.markers
              .map(key => this._trailMarkers[key])
              .filter(m => m)
              .map(m => m.getLatLng());
            if (bounds.length > 0) {
              this._map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
            }
          }
        });
      });
    },

    _updateVisibility() {
      const data = Alpine.store('app').data;
      if (!data) return;
      const mapData = data['map'];

      for (let trailId in mapData) {
        let trail = mapData[trailId];
        if (!trail.markers) continue;
        let showTrailMarkers = this._type.flora && (this._trail === 'all' || this._trail === trailId);
        trail.markers.forEach(key => {
          let marker = this._trailMarkers[key];
          if (marker) {
            if (showTrailMarkers) {
              if (!this._map.hasLayer(marker)) marker.addTo(this._map);
            } else {
              if (this._map.hasLayer(marker)) marker.remove();
            }
          }
        });
      }

      for (let id in this._birdMarkers) {
        let marker = this._birdMarkers[id];
        if (this._type.fauna) {
          if (!this._map.hasLayer(marker)) marker.addTo(this._map);
        } else {
          if (this._map.hasLayer(marker)) marker.remove();
          if (this._polygons[id] && this._map.hasLayer(this._polygons[id])) {
            this._polygons[id].remove();
          }
        }
      }
    },

    openCallout(locationId) {
      if (this._trailMarkers[locationId]) {
        this._trailMarkers[locationId].openPopup();
      }
    }
  }));
});
