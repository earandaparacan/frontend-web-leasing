import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { ChevronRightIcon } from "@/components/icons";
import type { Pagination } from "@/lib/staff-data";
import styles from "./staff-data-view.module.css";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type DataRow = {
  id: string;
  cells: ReactNode[];
};

type FilterOption = {
  value: string;
  label: string;
};

type StaffDataViewProps = {
  basePath: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: IconComponent;
  columns: string[];
  rows: DataRow[];
  pagination: Pagination;
  search: string;
  searchPlaceholder: string;
  filterName: string;
  filterLabel: string;
  filterValue: string;
  filterOptions: FilterOption[];
  emptyTitle: string;
  emptyDescription: string;
  error?: string;
};

function pageHref(
  basePath: string,
  page: number,
  search: string,
  filterName: string,
  filterValue: string,
) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (filterValue) query.set(filterName, filterValue);
  query.set("page", String(page));
  return `${basePath}?${query}`;
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "good" | "warning" | "bad" | "neutral" | "info";
}) {
  return <span className={`${styles.statusPill} ${styles[`statusPill--${tone}`]}`}><i />{label}</span>;
}

export function StaffDataView({
  basePath,
  eyebrow,
  title,
  description,
  icon: Icon,
  columns,
  rows,
  pagination,
  search,
  searchPlaceholder,
  filterName,
  filterLabel,
  filterValue,
  filterOptions,
  emptyTitle,
  emptyDescription,
  error,
}: StaffDataViewProps) {
  return (
    <div className={`${styles.page} workspace-page`}>
      <nav className={styles.breadcrumb} aria-label="Migas de pan">
        <Link href="/panel">Dashboard</Link>
        <ChevronRightIcon />
        <span>{title}</span>
      </nav>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.icon}><Icon /></div>
      </header>

      <section className={styles.dataCard} aria-labelledby="data-heading">
        <div className={styles.cardHeader}>
          <div>
            <span>REGISTROS</span>
            <h2 id="data-heading">Vista general</h2>
          </div>
          <span className={styles.totalBadge}>{pagination.total} en total</span>
        </div>

        <form className={styles.filters} method="get">
          <label>
            <span className="sr-only">Buscar</span>
            <SearchIcon />
            <input name="search" defaultValue={search} placeholder={searchPlaceholder} />
          </label>
          <select name={filterName} defaultValue={filterValue} aria-label={filterLabel}>
            <option value="">{filterLabel}: todos</option>
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="submit">Aplicar filtros</button>
          {search || filterValue ? <Link href={basePath}>Limpiar</Link> : null}
        </form>

        {error ? <div className={styles.error}><strong>No se pudieron cargar los registros</strong><span>{error}</span></div> : null}

        <div className={styles.tableWrap}>
          <table>
            <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>{row.cells.map((cell, index) => <td key={`${row.id}-${columns[index]}`}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>

        {!error && rows.length === 0 ? (
          <div className={styles.emptyState}>
            <span><Icon /></span>
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        ) : null}

        {!error && pagination.total_pages > 1 ? (
          <footer className={styles.pagination}>
            <span>Página {pagination.page} de {pagination.total_pages}</span>
            <div>
              {pagination.page > 1 ? (
                <Link href={pageHref(basePath, pagination.page - 1, search, filterName, filterValue)}>Anterior</Link>
              ) : <span>Anterior</span>}
              {pagination.page < pagination.total_pages ? (
                <Link href={pageHref(basePath, pagination.page + 1, search, filterName, filterValue)}>Siguiente</Link>
              ) : <span>Siguiente</span>}
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}
