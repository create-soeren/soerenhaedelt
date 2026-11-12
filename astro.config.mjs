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

// Vorerst unter der GitHub-Adresse. Beim Umzug auf soerenhaedelt.com: site auf die Domain, base entfernen,
// noindex aus den Seiten nehmen.
export default defineConfig({
  site: 'https://create-soeren.github.io',
  base: '/soerenhaedelt',
  integrations,
});
