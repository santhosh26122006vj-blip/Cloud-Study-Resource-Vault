/** Student My Resources route. */
import { initAuthGuard } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  initAuthGuard({ requireAuth: true }, () => {
    window.location.replace('resources.html');
  });
});
