// Generic CRUD factory. Every table module builds on this so behaviour stays
// consistent and the per-table files only declare their foreign-key helpers.
//
// All functions throw the Supabase error on failure (so callers can try/catch),
// and return the parsed data on success.
import { supabase } from '../supabaseClient.js';

/**
 * @param {string} table  Postgres table name.
 */
export function makeCrud(table) {
  return {
    table,

    /**
     * List rows with optional pagination, ordering and equality filters.
     * @param {object} [opts]
     * @param {string} [opts.select='*']     Columns / embedded relations to select.
     * @param {number} [opts.limit]          Page size.
     * @param {number} [opts.offset=0]       Rows to skip.
     * @param {string} [opts.orderBy]        Column to sort by.
     * @param {boolean}[opts.ascending=true] Sort direction.
     * @param {object} [opts.filters]        { column: value } equality filters.
     * @returns {Promise<{ data: any[], count: number|null }>}
     * List rows with optional pagination, ordering, equality + `lt` filters.
     * @param {object} [opts.lt]            { column: value } "<" filters (curseur).
     * @param {boolean}[opts.withCount=true] set false to skip the exact count.
     */
    async list({
      select = '*', limit, offset, orderBy, ascending = true,
      filters,gte, lt, withCount = true,
    } = {}) {
      let q = supabase.from(table).select(select, withCount ? { count: 'exact' } : undefined);
      if (filters) for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
      if (lt)      for (const [col, val] of Object.entries(lt))      q = q.lt(col, val);
      if (gte) for (const [c, v] of Object.entries(gte)) q = q.gte(c, v);

      if (orderBy) q = q.order(orderBy, { ascending });
      if (typeof limit === 'number') {
        const start = offset ?? 0;
        q = q.range(start, start + limit - 1);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { data, count };
    },

    /** Return ALL rows where column IN values (batch fetch — ex. résolution de plusieurs ids). */
    async findByIn(column, values, { select = '*', orderBy, ascending = true } = {}) {
      if (!values?.length) return [];
      let q = supabase.from(table).select(select).in(column, values);
      if (orderBy) q = q.order(orderBy, { ascending });
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    /** Fetch a single row by primary key. Throws if not found. */
    async get(id, { select = '*' } = {}) {
      const { data, error } = await supabase.from(table).select(select).eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async getOneBy(filters, select = '*') {
      let q = supabase.from(table).select(select);
      if (filters) for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);

      const { data, error } = await q.single();

      if (error) {
        if (error.code === 'PGRST116') return null; // 0 lignes → not found
        throw error;                                 // vraie erreur DB
      }

      return data;
    },
    async getBy(filters, select = '*') {
  let q = supabase.from(table).select(select);
  if (filters) for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);

  const { data, error } = await q;

  if (error) throw error;

  return data; // [] si aucun résultat
},

    /** Insert one row (object) or many (array). Returns the inserted row(s). */
    async create(values) {
      const { data, error } = await supabase.from(table).insert(values).select();
      if (error) throw error;
      return Array.isArray(values) ? data : data[0];
    },

    /** Update a row by primary key with a partial patch. Returns the new row. */
    async update(id, patch) {
      const { data, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Delete a row by primary key. Returns true. */
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    /** Count rows, optionally filtered. */
    async count(filters = {}) {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
      const { count, error } = await q;
      if (error) throw error;
      return count;
    },

    /** Return ALL rows where column = value (used by foreign-key helpers). */
    async findBy(column, value, { select = '*', orderBy, ascending = true, limit, offset } = {}) {
      let q = supabase.from(table).select(select).eq(column, value);
      if (orderBy) q = q.order(orderBy, { ascending });
      if (typeof limit === 'number') {
        const start = offset ?? 0;
        q = q.range(start, start + limit - 1);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    /** Return the SINGLE row where column = value, or null (used for unique columns). */
    async findOneBy(column, value, { select = '*' } = {}) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq(column, value)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export default makeCrud;
