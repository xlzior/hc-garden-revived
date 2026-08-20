// js/components/filter-modal.js
document.addEventListener('alpine:init', () => {
  Alpine.data('filterModal', () => ({
    isOpen: false,
    enableFilter: [],
    settings: { type: { flora: true, fauna: true }, trail: 'all', sortBy: 'alphabetical' },
    typeOptions: [
      { id: 'flora', name: 'Flora' },
      { id: 'fauna', name: 'Fauna' }
    ],
    trailOptions: [
      { id: 'trail-01', name: 'Jing Xian Trail (College)' },
      { id: 'trail-02', name: 'Kong Chian Trail (High school)' },
      { id: 'trail-03', name: 'Kah Kee Trail (High School)' },
      { id: 'all', name: 'All' }
    ],
    sortOptions: [
      { id: 'alphabetical', name: 'Alphabetical order' },
      { id: 'distance', name: 'Distance' }
    ],
    openModal() {
      this.enableFilter = Alpine.store('app').showFilter
        ? ['type', 'trail']
        : ['type', 'trail', 'sortBy'];
      const current = Alpine.store('app').filterSettings;
      this.settings = {
        type: { flora: current.type.flora, fauna: current.type.fauna },
        trail: current.trail,
        sortBy: current.sortBy
      };
      this.isOpen = true;
    },
    closeModal() {
      this.isOpen = false;
    },
    updateType(id) {
      this.settings.type[id] = !this.settings.type[id];
      this._dispatch();
    },
    updateTrail(id) {
      this.settings.trail = id;
      this._dispatch();
    },
    updateSort(id) {
      if (id === 'distance' && !this._hasLocation()) {
        alert('Please try again.\nWe\'re still trying to find your location');
        return;
      }
      this.settings.sortBy = id;
      this._dispatch();
    },
    _hasLocation() {
      return window._userLat != null && window._userLon != null;
    },
    _dispatch() {
      Alpine.store('app').filterSettings = { ...this.settings, type: { ...this.settings.type } };
      window.dispatchEvent(new CustomEvent('filter-changed', { detail: { ...this.settings } }));
    }
  }));
});
