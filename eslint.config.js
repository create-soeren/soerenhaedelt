// Gate für den Browser-Code: findet toten Code und echte Fehler in src/scripts. CSS prüft stylelint.
import js from "@eslint/js";
import globals from "globals";

export default [
  { files: ["src/scripts/**/*.js"], ...js.configs.recommended, languageOptions: { globals: globals.browser } },
  // Leere catch-Blöcke sind gewollt (localStorage, Zugriffe, die scheitern dürfen).
  { files: ["src/scripts/**/*.js"], rules: { "no-empty": ["error", { allowEmptyCatch: true }] } },
];
