/** Load later pages too: selected QA choices can be unapproved or beyond page one. */
export async function completeCatalogPages(data, definitions, request, pageSize = 200) {
  for (const [key, field] of Object.entries(definitions)) {
    let page = data[key] || [];
    const rows = [...page];
    let offset = page.length;
    while (page.length === pageSize) {
      const result = await request(`query RevisionCatalogPage($offset: Int!) { rows: ${field} offset: $offset, limit: ${pageSize}) { id ${key.toLowerCase().includes('allergen') ? 'allergen type' : 'name'} } }`, { offset });
      page = result.rows || [];
      const seen = new Set(rows.map(item => String(item.id)));
      const added = page.filter(item => !seen.has(String(item.id)));
      if (page.length && !added.length) throw new Error('Catalog pagination did not advance; selected choices cannot be resolved safely.');
      rows.push(...added); offset += page.length;
    }
    data[key] = rows;
  }
  return data;
}
