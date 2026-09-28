/**
 * My Resources Redirect Controller
 * Routes administrators to the centralized Admin Portal (admin.html),
 * and students to the Browse Resources page (resources.html).
 */

import { initAuthGuard } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  initAuthGuard({ requireAuth: true, requireAdmin: false }, (profile) => {
    if (profile?.role === 'admin') {
      window.location.replace('admin.html');
    } else {
      window.location.replace('resources.html');
    }
  });
});
