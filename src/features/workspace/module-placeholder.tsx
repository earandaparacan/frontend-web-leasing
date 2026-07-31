import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ChevronRightIcon } from "@/components/icons";
import styles from "./module-placeholder.module.css";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: IconComponent;
  columns: string[];
};

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  icon: Icon,
  columns,
}: ModulePlaceholderProps) {
  return (
    <div className={styles.page}>
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
          <span className={styles.connectionBadge}><i /> Pendiente de integración</span>
        </div>
        <div className={styles.tableHeader} aria-hidden="true">
          {columns.map((column) => <span key={column}>{column}</span>)}
        </div>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><Icon /></span>
          <strong>{emptyTitle}</strong>
          <p>{emptyDescription}</p>
        </div>
      </section>
    </div>
  );
}
