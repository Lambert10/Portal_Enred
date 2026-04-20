import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";

const coverPool = [
  "https://images.pexels.com/photos/7567434/pexels-photo-7567434.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/7567558/pexels-photo-7567558.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/6693655/pexels-photo-6693655.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/7552374/pexels-photo-7552374.jpeg?auto=compress&cs=tinysrgb&w=1600",
];

const coverBySlug = {
  abastible: { src: "/logos/abastible.png", mode: "contain", tone: "light" },
  andesmotor: { src: "/logos/andes-motors.jpg", mode: "cover" },
  "andes-motors": { src: "/logos/andes-motors.jpg", mode: "cover" },
};

function coverFor(slug, index) {
  const key = String(slug || "").toLowerCase();
  if (coverBySlug[key]) {
    return coverBySlug[key];
  }

  if (!slug) return { src: coverPool[index % coverPool.length], mode: "cover" };

  const hash = [...slug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return { src: coverPool[hash % coverPool.length], mode: "cover" };
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
            Accede a dashboards externos por cliente con una experiencia visual clara y orientada a accion.
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
        {items.map((client, idx) => {
          const cover = coverFor(client.slug, idx);
          return (
            <Link key={client.slug} className="dashCard" to={`/dashboard/${client.slug}`}>
              <div
                className={`dashCardMedia ${cover.mode === "contain" ? "dashCardMediaLogo" : ""} ${
                  cover.tone === "light" ? "dashCardMediaLogoLight" : ""
                }`}
              >
                <img
                  className="dashCardImage"
                  src={cover.src}
                  alt={cover.mode === "contain" ? `Logo de ${client.name}` : `Vista analitica de ${client.name}`}
                  loading="lazy"
                />
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
                  <span>Dashboard externo</span>
                  <span>Cliente</span>
                  <span>En linea</span>
                </div>

                <div className="dashCardCta">
                  <span>Abrir dashboard</span>
                  <span>/dashboard/{client.slug}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
