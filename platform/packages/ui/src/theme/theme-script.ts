// Inline script that runs before React hydration to set the correct theme class
// on <html>. This prevents a flash of the wrong theme on page load.
export const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('blackfyre-theme');
    var theme = stored || 'system';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(resolved);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;
