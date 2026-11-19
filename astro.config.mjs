// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'astro/config';

// Token-Kit (prototype-kit) im Dev-Server, nur wo eine lokale kit.json liegt. Im Repo und auf GitHub Actions fehlt sie,
// der Build braucht das Kit nicht: tokens.css ist eingecheckt.
const integrations = [];
if (existsSync('kit.json')) {
  const { kit: kitPath } = JSON.parse(readFileSync('kit.json', 'utf8'));
  const { default: kit } = await import(pathToFileURL(resolve(kitPath, 'src/astro.mjs')).href);
  integrations.push(kit(process.cwd()));
}

// Seit dem Umzug (19.11.2026) auf soerenhaedelt.com, ohne base. GitHub Pages kann keine Server-Weiterleitungen: Astro baut
// pro alter Framer-Adresse eine Seite mit Meta-Refresh, noindex und canonical auf das Ziel. Alte Case Studies, die es nicht
// mehr gibt, führen auf die Projektliste. Das Archiv (/archiv/ip_projektausfluginsgrüne) war tot und bleibt ohne Ziel.
export default defineConfig({
  site: 'https://soerenhaedelt.com',
  redirects: {
    '/projects/anita_app': '/cases/anita-app/',
    '/projects/anita_website': '/cases/anita-website/',
    '/projects/paxa': '/cases/paxa/',
    '/projects/silicon-allee': '/cases/silicon-allee/',
    '/projects/fixit': '/cases/fixit/',
    '/projects/perfectproperties': '/projects/',
    '/projects/prossistance/page1': '/projects/',
    '/projects/prossistance/page2': '/projects/',
    '/projects/iur.crowd': '/projects/',
  },
  integrations,
});
