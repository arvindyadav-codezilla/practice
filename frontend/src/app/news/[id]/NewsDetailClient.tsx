"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface NewsComment {
  author: string;
  text: string;
  timestamp: string;
}

interface NewsItem {
  id: string;
  title: string;
  link: string;
  description: string;
  imageUrl: string;
  pubDate: string;
  likes: number;
  comments: NewsComment[];
}

export default function NewsDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  // Enable document body scrolling on mount, reset to hidden on unmount
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, []);

  // Initialize the server URL on client-side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        setServerUrl(`${protocol}//127.0.0.1:8000/ws`);
      } else {
        setServerUrl(process.env.NEXT_PUBLIC_WS_SERVER_URL || "wss://practice-ihvr.onrender.com/ws");
      }
    }
  }, []);

  const getHttpUrl = (path: string) => {
    try {
      const url = new URL(serverUrl);
      const protocol = url.protocol === "wss:" ? "https:" : "http:";
      return `${protocol}//${url.host}${path}`;
    } catch {
      return "";
    }
  };

  const loadDetails = async () => {
    const url = getHttpUrl(`/api/news/${id}`);
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.title) {
        setItem(data);
      } else {
        setItem(null);
      }
    } catch (err) {
      console.error("Error loading details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverUrl) {
      loadDetails();
    }
  }, [serverUrl, id]);

  const handleLike = async () => {
    if (!item) return;
    const url = getHttpUrl(`/api/news/${id}/like`);
    if (!url) return;
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.status === "ok") {
        setItem((prev) => prev ? { ...prev, likes: data.likes } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text || !item) return;
    const url = getHttpUrl(`/api/news/${id}/comment`);
    if (!url) return;

    let username = "Guest";
    if (typeof window !== "undefined") {
      username = localStorage.getItem("synapse_username") || "Guest";
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, username }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setItem((prev) => prev ? { ...prev, comments: [...prev.comments, data.comment] } : null);
        setCommentInput("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = () => {
    if (!item) return;
    navigator.clipboard.writeText(item.link);
    setToastMsg("Link copied to clipboard!");
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleGetSummary = async () => {
    if (!item) return;
    const url = getHttpUrl(`/api/news/${id}/summary`);
    if (!url) return;
    setSummarizing(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "ok") {
        setAiSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizing(false);
    }
  };

  const formatNewsDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || "Recently";
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return dateStr || "Recently";
    }
  };

  if (loading) {
    return (
      <div className="news-page-container" style={{ justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div className="message-media" style={{ minHeight: "150px", border: "none" }}>
          <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: 500 }}>Loading article details...</span>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="news-page-container" style={{ justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <h2 style={{ color: "#fff", marginBottom: "16px" }}>Article Not Found</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>The news article you are looking for does not exist or has expired.</p>
        <Link href="/news" className="back-to-chat-btn">
          Back to News Feed
        </Link>
      </div>
    );
  }

  return (
    <div className="news-page-container" style={{ maxWidth: "800px", padding: "40px 16px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link href="/news" className="back-to-chat-btn" style={{ display: "inline-flex", width: "fit-content" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Feed
        </Link>
      </div>

      <article className="glass-card" style={{ padding: "32px", borderRadius: "24px", border: "1px solid var(--panel-border)", background: "var(--panel-bg)", backdropFilter: "blur(12px)" }}>
        {item.imageUrl && (
          <div style={{ width: "100%", height: "400px", borderRadius: "16px", overflow: "hidden", marginBottom: "24px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <img src={item.imageUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "13px", color: "var(--text-dim)", marginBottom: "16px" }}>
          <span>📅 {formatNewsDate(item.pubDate)}</span>
          <span>•</span>
          <span>📰 Source: {new URL(item.link).hostname.replace('www.', '')}</span>
        </div>

        <h1 className="news-page-title" style={{ fontSize: "28px", lineHeight: "1.35", color: "#fff", marginBottom: "20px", background: "none", WebkitTextFillColor: "initial", textAlign: "left" }}>
          {item.title}
        </h1>

        {/* AI Summarizer Widget */}
        <div style={{
          background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
          border: "1px solid rgba(168, 85, 247, 0.2)",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "24px",
          textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: aiSummary ? "14px" : "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>✨</span>
              <div>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#e9d5ff" }}>Nova AI Summarizer</h4>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--text-dim)" }}>Extract 3 key takeaways using generative AI</p>
              </div>
            </div>
            {!aiSummary && (
              <button
                onClick={handleGetSummary}
                disabled={summarizing}
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "8px 16px",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: summarizing ? 0.7 : 1,
                  boxShadow: "0 4px 12px rgba(168, 85, 247, 0.2)"
                }}
              >
                {summarizing ? "Summarizing..." : "Summarize Article"}
              </button>
            )}
          </div>
          {aiSummary && (
            <div style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: "1.6", whiteSpace: "pre-line" }}>
              {aiSummary}
            </div>
          )}
        </div>

        <p style={{ fontSize: "16px", lineHeight: "1.7", color: "var(--text-main)", marginBottom: "32px", textAlign: "left" }}>
          {item.description}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 0", marginBottom: "32px" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="news-page-action-btn like" onClick={handleLike} style={{ fontSize: "14px", padding: "10px 18px" }}>
              <span>❤️ Like</span> {item.likes}
            </button>
            <button className="news-page-action-btn share" onClick={handleShare} style={{ fontSize: "14px", padding: "10px 18px" }}>
              <span>📤 Share</span>
            </button>
          </div>

          <a href={item.link} target="_blank" rel="noopener noreferrer" className="back-to-chat-btn" style={{ background: "var(--primary-gradient)", border: "none", boxShadow: "0 4px 12px var(--primary-glow)" }}>
            Read Full Article
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "6px" }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>

        <div id="comments" style={{ textAlign: "left" }}>
          <h3 style={{ fontSize: "18px", color: "#fff", marginBottom: "20px", fontWeight: 700 }}>Discussion ({item.comments.length})</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
            {item.comments.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-dim)", background: "rgba(255,255,255,0.01)", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.06)" }}>
                No comments on this article yet. Be the first to share your thoughts!
              </div>
            ) : (
              item.comments.map((c, i) => (
                <div key={i} style={{ padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "13px" }}>{c.author}</span>
                    <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                      {formatNewsDate(c.timestamp)}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-main)", margin: 0, lineHeight: "1.5" }}>{c.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddComment} style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              placeholder="Join the discussion..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              required
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                padding: "12px 16px",
                color: "#fff",
                fontSize: "14px",
                outline: "none"
              }}
            />
            <button type="submit" className="back-to-chat-btn" style={{ padding: "12px 24px" }}>
              Comment
            </button>
          </form>
        </div>
      </article>

      {toastMsg && (
        <div className="toast-notification">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
