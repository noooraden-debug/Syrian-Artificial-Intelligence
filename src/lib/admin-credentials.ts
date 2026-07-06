export const ADMIN_USERNAME = "الجوكر";
export const ADMIN_ALIASES = ["الجوكر", "joker"];
export const ADMIN_PASSWORD = "admin123";

export function isAdminAlias(username: string) {
  const normalized = username.trim().toLowerCase();
  return ADMIN_ALIASES.some((alias) => alias.toLowerCase() === normalized);
}
