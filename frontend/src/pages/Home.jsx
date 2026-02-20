import React from "react";
import { Link } from "react-router-dom";

const highlights = [
  {
    title: "Multi-cliente real",
    description:
      "Gestiona multiples empresas desde una sola vista y separa dashboards por slug sin duplicar codigo.",
    chip: "Arquitectura",
    icon: "layers",
    image:
      "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=900",
    imagePosition: "center 35%",
  },
  {
    title: "Operacion agil",
    description:
      "Actualiza enlaces desde base de datos y publica cambios del portal sin tocar deploy del frontend.",
    chip: "Operacion",
    icon: "speed",
    image:
      "https://images.pexels.com/photos/7567566/pexels-photo-7567566.jpeg?auto=compress&cs=tinysrgb&w=900",
    imagePosition: "center 45%",
  },
  {
    title: "Escalable a seguridad",
    description:
      "El MVP parte con Publish to web y evoluciona a login real, roles y embed tokens por cliente.",
    chip: "Roadmap",
    icon: "shield",
    image:
      "https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=900",
    imagePosition: "center 42%",
  },
];

const useCases = [
  {
    title: "Seguimiento comercial",
    subtitle: "Ventas, cobertura y productividad por zona",
    image:
      "https://images.pexels.com/photos/590020/pexels-photo-590020.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    title: "Control operativo",
    subtitle: "Estado de procesos y cuellos de botella",
    image:
      "https://images.pexels.com/photos/7654576/pexels-photo-7654576.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    title: "Planeacion ejecutiva",
    subtitle: "KPIs globales para toma de decisiones",
    image:
      "https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
];

function CapabilityIcon({ icon }) {
  if (icon === "speed") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3a9 9 0 1 0 9 9M12 12l5-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="homePage">
      <section className="homeHero">
        <div className="homeHeroCopy">
          <div className="homeEyebrow">Portal Enred | BI para clientes</div>
          <h1>Entrega dashboards Power BI en un portal moderno y claro</h1>
          <p>
            Centraliza reportes por cliente, define accesos y muestra informacion clave en una experiencia
            web mas ordenada. El objetivo es pasar de MVP rapido a una plataforma empresarial.
          </p>

          <div className="homeCtas">
            <Link to="/login" className="homeBtnPrimary">
              Ingresar
            </Link>
            <Link to="/dashboards" className="homeBtnGhost">
              Ver dashboards
            </Link>
          </div>

          <div className="homeKpis">
            <article className="homeKpiCard">
              <span>Clientes activos</span>
              <strong>+24</strong>
            </article>
            <article className="homeKpiCard">
              <span>Dashboards publicados</span>
              <strong>58</strong>
            </article>
            <article className="homeKpiCard">
              <span>Tiempo de habilitacion</span>
              <strong>1 dia</strong>
            </article>
          </div>

          <div className="homeInlineCapabilities">
            <div className="homeInlineTitle">Capacidades clave</div>
            <div className="homeInlineGrid">
              {highlights.map((item, idx) => (
                <article className="homeInlineCard" key={item.title}>
                  <div className="homeInlineTop">
                    <span className="homeChip">{item.chip}</span>
                    <span className="homeInlineIdx">{`0${idx + 1}`}</span>
                  </div>

                  <div className="homeInlineBody">
                    <div className="homeInlineText">
                      <span className="homeInlineIcon" aria-hidden="true">
                        <CapabilityIcon icon={item.icon} />
                      </span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                    </div>

                    <div className="homeInlineMedia">
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        style={{ objectPosition: item.imagePosition || "center center" }}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="homeHeroVisual">
          <article className="homeVisualCard">
            <img
              src="https://images.pexels.com/photos/7567529/pexels-photo-7567529.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="Equipo revisando dashboards de analitica"
            />
            <div className="homeVisualLabel">Monitoreo en tiempo real</div>
          </article>
          <article className="homeVisualCard homeVisualCardOffset">
            <img
              src="https://images.pexels.com/photos/7947663/pexels-photo-7947663.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="Analista presentando resultados a equipo"
            />
            <div className="homeVisualLabel">Presentaciones para clientes</div>
          </article>
        </div>
      </section>

      <section className="homeSection">
        <div className="homeSectionHead">
          <h2>Escenarios de uso</h2>
          <p>Visualiza resultados por area con contexto y narrativa de negocio.</p>
        </div>

        <div className="homeShowcaseGrid">
          {useCases.map((item) => (
            <article className="homeShowcaseCard" key={item.title}>
              <img src={item.image} alt={item.title} />
              <div className="homeShowcaseBody">
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="homeSection homeSplit">
        <article className="homePanel">
          <h2>Ruta de evolucion</h2>
          <ol className="homeTimeline">
            <li>
              <strong>MVP operativo</strong>
              <span>Portal funcional con Publish to web por cliente.</span>
            </li>
            <li>
              <strong>Control de acceso</strong>
              <span>Login real con JWT, renovacion de sesion y guardado seguro.</span>
            </li>
            <li>
              <strong>Administracion</strong>
              <span>Panel admin para clientes, URLs embed y auditoria de cambios.</span>
            </li>
          </ol>
        </article>

        <article className="homePanel">
          <h2>Preguntas frecuentes</h2>
          <div className="homeFaqs">
            <details>
              <summary>Se puede usar con multiples clientes?</summary>
              <p>Si. Cada cliente se identifica por slug y puede tener su propio dashboard embed.</p>
            </details>
            <details>
              <summary>Como se actualizan los tableros?</summary>
              <p>Al cambiar el enlace embed en base de datos, el portal refleja el ajuste sin redeploy.</p>
            </details>
            <details>
              <summary>Es posible endurecer seguridad?</summary>
              <p>Si. El siguiente paso es migrar a embed tokens y autenticacion formal por usuario.</p>
            </details>
          </div>
        </article>
      </section>
    </div>
  );
}
