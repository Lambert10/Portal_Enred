import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../lib/api";

export default function DashboardClient() {
  const { slug } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [client, setClient] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenErr, setFullscreenErr] = useState("");

  const frameWrapRef = useRef(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      setClient(null);
      setIframeLoaded(false);
      setFullscreenErr("");

      try {
        const data = await apiGet(`/api/clients/${slug}/embed`);
        if (!alive) return;
        setClient(data);
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
  }, [slug]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function enterFullscreen() {
    setFullscreenErr("");
    const element = frameWrapRef.current;
    if (!element) return;

    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else {
        setFullscreenErr("Tu navegador no soporta pantalla completa.");
      }
    } catch (e) {
      setFullscreenErr("No se pudo activar pantalla completa.");
    }
  }

  async function exitFullscreen() {
    setFullscreenErr("");

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {
      setFullscreenErr("No se pudo salir de pantalla completa.");
    }
  }

  if (loading) return <div className="state">Cargando dashboard...</div>;
  if (err) return <div className="state error">Error: {err}</div>;
  if (!client) return <div className="state">Sin datos</div>;

  return (
    <div>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>{client.name}</h2>
          <p style={styles.sub}>/dashboard/{client.slug}</p>
        </div>

        {!isFullscreen ? (
          <button onClick={enterFullscreen} style={styles.btn}>
            Pantalla completa
          </button>
        ) : (
          <button onClick={exitFullscreen} style={styles.btn}>
            Salir
          </button>
        )}
      </div>

      {fullscreenErr && <div className="state error">{fullscreenErr}</div>}
      {!iframeLoaded && <div className="state">Cargando reporte...</div>}

      <div
        ref={frameWrapRef}
        style={{
          ...styles.frameWrap,
          ...(isFullscreen ? styles.frameWrapFullscreen : {}),
        }}
      >
        {isFullscreen && (
          <div style={styles.fullscreenTopbar}>
            <span style={styles.fullscreenTitle}>{client.name}</span>
            <button onClick={exitFullscreen} style={styles.fullscreenBtn}>
              Salir
            </button>
          </div>
        )}

        <iframe
          title={`PowerBI-${client.slug}`}
          src={client.embed_url}
          style={{
            ...styles.iframe,
            ...(isFullscreen ? styles.iframeFullscreen : {}),
          }}
          frameBorder="0"
          allowFullScreen
          onLoad={() => setIframeLoaded(true)}
        />
      </div>
    </div>
  );
}

const styles = {
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 18,
    letterSpacing: 0.2,
  },
  sub: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "rgba(232,236,255,.68)",
  },
  btn: {
    cursor: "pointer",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(232,236,255,.92)",
    fontSize: 13,
    fontWeight: 600,
  },
  frameWrap: {
    width: "100%",
    height: "82vh",
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    boxShadow: "0 18px 70px rgba(0,0,0,.4)",
    position: "relative",
  },
  frameWrapFullscreen: {
    width: "100vw",
    height: "100vh",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
    background: "#0b1020",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
  },
  iframeFullscreen: {
    height: "calc(100vh - 52px)",
  },
  fullscreenTopbar: {
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 14px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    background: "rgba(0,0,0,.25)",
    backdropFilter: "blur(10px)",
  },
  fullscreenTitle: {
    fontSize: 13,
    opacity: 0.9,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  fullscreenBtn: {
    cursor: "pointer",
    padding: "9px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(232,236,255,.92)",
    fontSize: 13,
    fontWeight: 700,
  },
};
