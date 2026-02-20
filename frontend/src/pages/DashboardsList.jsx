import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";

const coverPool = [
  "https://images.pexels.com/photos/7567434/pexels-photo-7567434.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/7567558/pexels-photo-7567558.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/6693655/pexels-photo-6693655.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/7552374/pexels-photo-7552374.jpeg?auto=compress&cs=tinysrgb&w=1600",
];

function coverFor(slug, index) {
  if (!slug) return coverPool[index % coverPool.length];
  const hash = [...slug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return coverPool[hash % coverPool.length];
}

export default function DashboardsList() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      setItems([]);

      try {
        const data = await apiGet("/api/clients");
        if (!alive) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const hasItems = useMemo(() => items.length > 0, [items]);
  const primaryClient = useMemo(() => items[0]?.name || "-", [items]);

  if (loading) return <div className="state">Cargando dashboards...</div>;
  if (err) return <div className="state error">Error: {err}</div>;
  if (!hasItems) return <div className="state">No hay dashboards disponibles.</div>;

  return (
    <div className="dashListWrap">
      <section className="dashHero">
        <div>
          <div className="dashEyebrow">Vista ejecutiva</div>
          <h2 className="dashHeroTitle">Catalogo de dashboards por cliente</h2>
          <p className="dashHeroSub">
            Accede a reportes corporativos con una experiencia visual mas clara y orientada a accion.
          </p>
        </div>

        <div className="dashHeroStats">
          <article className="dashStat">
            <span>Clientes activos</span>
            <strong>{items.length}</strong>
          </article>
          <article className="dashStat">
            <span>Principal</span>
            <strong>{primaryClient}</strong>
          </article>
          <article className="dashStat">
            <span>Estado plataforma</span>
            <strong>Operativa</strong>
          </article>
        </div>
      </section>

      <section className="dashCardsGrid">
        {items.map((client, idx) => (
          <Link key={client.slug} className="dashCard" to={`/dashboard/${client.slug}`}>
            <div className="dashCardMedia">
              <img src={coverFor(client.slug, idx)} alt={`Vista analitica de ${client.name}`} loading="lazy" />
              <span className="dashCardBadge">Activo</span>
            </div>

            <div className="dashCardBody">
              <div className="dashCardHead">
                <h3>{client.name}</h3>
                <span className="dashCardSlug">{client.slug}</span>
              </div>

              <p className="dashCardDesc">
                Dashboard centralizado para seguimiento de KPIs, avances operativos y lectura ejecutiva.
              </p>

              <div className="dashCardTags">
                <span>Power BI</span>
                <span>Cliente</span>
                <span>En linea</span>
              </div>

              <div className="dashCardCta">
                <span>Abrir dashboard</span>
                <span>/dashboard/{client.slug}</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
