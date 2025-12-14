import { fetchJson } from "./api";

export async function fetchCategories(fetchOptions = {}) {
  try {
    const data = await fetchJson("/api/threads/categories", fetchOptions);
    if (Array.isArray(data.categories)) {
      return data.categories.map(({ slug, name }) => ({ slug, name }));
    }
    return [];
  } catch (err) {
    console.error("Failed to fetch categories", err);
    return [];
  }
}
