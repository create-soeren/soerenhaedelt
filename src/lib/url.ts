// Alle internen Adressen laufen über base. Auf der eigenen Domain ist base leer, auf einer Unterseite wie github.io/<repo> trägt es den Pfad.
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const url = (path = "") => `${base}/${path}`;
