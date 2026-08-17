// js/components/overview.js
document.addEventListener('alpine:init', () => {
  Alpine.data('overview', () => ({
    get title() {
      return Alpine.store('app')._routeParams.title || 'Overview';
    }
  }));
});
