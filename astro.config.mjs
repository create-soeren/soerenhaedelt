// @ts-check
import { defineConfig } from 'astro/config';

// Vorerst unter der GitHub-Adresse. Beim Umzug auf soerenhaedelt.com: site auf die Domain, base entfernen,
// noindex aus den Seiten nehmen.
export default defineConfig({
  site: 'https://create-soeren.github.io',
  base: '/soerenhaedelt',
});
