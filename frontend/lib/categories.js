import { fetchJson } from "./api";

export async function fetchCategories(fetchOptions = {}) {
  try {
    const data = await fetchJson("/api/validation-cases/categories", fetchOptions);
    if (Array.isArray(data.categories)) {
      return data.categories.map(({ slug, name }) => ({ slug, name }));
    }
    return [];
  } catch (err) {
    // Silent fail - return empty array
    return [];
  }
}
