// Alle internen Adressen laufen über base (vorerst /soerenhaedelt), damit der Umzug auf die Domain eine Zeile ist.
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const url = (path = "") => `${base}/${path}`;
export const asset = (path: string) => `${base}/${path}`;
