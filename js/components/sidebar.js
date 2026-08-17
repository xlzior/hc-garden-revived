// js/components/sidebar.js
document.addEventListener('alpine:init', () => {
  Alpine.data('sidebar', () => ({
    open: false,
    navItems: [
      { hash: '#home', route: 'home', label: 'Home' },
      { hash: '#introduction', route: 'introduction', label: 'Introduction' },
      { hash: '#map', route: 'map', label: 'Map' },
      { hash: '#flora-fauna', route: 'flora-fauna', label: 'Flora and Fauna' },
      { hash: '#history', route: 'history', label: 'Historical Photos' },
      { hash: '#committee-message', route: 'committee-message', label: 'Message from Committee' },
      { hash: '#acknowledgements', route: 'acknowledgements', label: 'Acknowledgements' },
      { hash: '#references', route: 'references', label: 'References' }
    ],
    toggle() {
      this.open = !this.open;
    },
    navigate(hash) {
      const parsed = parseRoute(hash);
      Alpine.store('app').currentRoute = parsed.screen;
      Alpine.store('app').headerTitle = HEADER_TITLES[parsed.screen] || parsed.screen;
      Alpine.store('app').showFilter = (parsed.screen === 'map' || parsed.screen === 'flora-fauna');
      window.history.pushState(null, '', hash);
      this.open = false;
    }
  }));
});
