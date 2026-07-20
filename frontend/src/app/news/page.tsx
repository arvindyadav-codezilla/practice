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

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeCommentBox, setActiveCommentBox] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(true);

  // Search & Filter parameters
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("Technology");
  const [country, setCountry] = useState("US");
  const [language, setLanguage] = useState("en");

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

  const loadNews = async () => {
    const params = new URLSearchParams({
      q: searchQuery,
      category: category,
      country: country,
      language: language
    });
    const url = getHttpUrl(`/api/news?${params.toString()}`);
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setNews(data);
      }
    } catch (err) {
      console.error("Error loading news:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverUrl) {
      loadNews();
    }
  }, [serverUrl, searchQuery, category, country, language]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const handleLikeNews = async (id: string) => {
    const url = getHttpUrl(`/api/news/${id}/like`);
    if (!url) return;
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.status === "ok") {
        setNews((prev) =>
          prev.map((item) => (item.id === id ? { ...item, likes: data.likes } : item))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text) return;
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
        setNews((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, comments: [...item.comments, data.comment] }
              : item
          )
        );
        setCommentInput("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareNews = (link: string) => {
    navigator.clipboard.writeText(link);
    setToastMsg("Link copied to clipboard!");
    setTimeout(() => setToastMsg(null), 3000);
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

  return (
    <div className="news-page-container">
      <div className="news-page-header">
        <div className="news-page-title-group">
          <h1 className="news-page-title">Trending Tech News</h1>
          <p className="news-page-subtitle">Stay updated with the latest in tech, parsed directly via RSS.</p>
        </div>
        <Link href="/" className="back-to-chat-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Chat
        </Link>
      </div>

      {/* Filters Panel */}
      <div className="news-filters-panel glass-card" style={{ padding: "20px", borderRadius: "16px", marginBottom: "32px", border: "1px solid var(--panel-border)", display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Search & Selectors Row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: "260px", display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Search news articles (e.g. AI, Space, Cricket...)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                flex: 1,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "10px 16px",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
                transition: "all 0.2s"
              }}
            />
            <button
              type="submit"
              style={{
                background: "var(--primary-gradient)",
                border: "none",
                borderRadius: "12px",
                padding: "10px 20px",
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 12px var(--primary-glow)",
                transition: "all 0.2s"
              }}
            >
              Search
            </button>
          </form>

          {/* Selectors */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            
            {/* Country Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase" }}>Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{
                  background: "rgba(15, 12, 30, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: "13px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="US">🇺🇸 United States</option>
                <option value="IN">🇮🇳 India</option>
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="CA">🇨🇦 Canada</option>
                <option value="AU">🇦🇺 Australia</option>
                <option value="ES">🇪🇸 Spain</option>
                <option value="FR">🇫🇷 France</option>
                <option value="DE">🇩🇪 Germany</option>
              </select>
            </div>

            {/* Language Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase" }}>Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  background: "rgba(15, 12, 30, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: "13px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="en">English</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
                <option value="de">German (Deutsch)</option>
              </select>
            </div>

          </div>
        </div>

        {/* Category Chips Scroll */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", textAlign: "left" }}>Category / Genre</span>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "none" }} className="hide-scrollbar">
            {["Technology", "Sports", "Entertainment", "Business", "Science", "Health", "Astrology", "World"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  background: category === cat ? "var(--primary-gradient)" : "rgba(255, 255, 255, 0.03)",
                  border: category === cat ? "none" : "1px solid rgba(255, 255, 255, 0.06)",
                  color: "#fff",
                  borderRadius: "20px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

      </div>

      {loading ? (
        <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <div className="message-media" style={{ minHeight: "150px", border: "none" }}>
            <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: 500 }}>Fetching latest feeds...</span>
          </div>
        </div>
      ) : (
        <div className="news-grid">
          {news.map((item) => (
            <div key={item.id} className="news-page-card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <Link href={`/news/${item.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", flex: 1 }}>
                {item.imageUrl && (
                  <div className="news-page-card-image">
                    <img src={item.imageUrl} alt={item.title} />
                  </div>
                )}
                <div className="news-page-card-content" style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-dim)", marginBottom: "8px", fontWeight: 500 }}>
                    <span>📅</span>
                    <span>{formatNewsDate(item.pubDate)}</span>
                  </div>
                  <h3 className="news-page-card-title" style={{ margin: "0 0 10px 0" }}>
                    {item.title}
                  </h3>
                  <p className="news-page-card-desc" style={{ flex: 1 }}>{item.description}</p>
                </div>
              </Link>
              
              <div className="news-page-card-footer" style={{ padding: "0 20px 20px" }}>
                <div className="news-page-card-actions" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "16px" }}>
                  <button className="news-page-action-btn like" onClick={() => handleLikeNews(item.id)}>
                    <span>❤️</span> {item.likes}
                  </button>
                  <button className="news-page-action-btn comment" onClick={() => setActiveCommentBox(activeCommentBox === item.id ? null : item.id)}>
                    <span>💬</span> {item.comments.length}
                  </button>
                  <button className="news-page-action-btn share" onClick={() => handleShareNews(item.link)}>
                    <span>📤</span> Share
                  </button>
                </div>

                {activeCommentBox === item.id && (
                  <div className="news-page-comments-section" style={{ marginTop: "16px" }}>
                    <div className="news-page-comments-list" style={{ maxHeight: "120px", overflowY: "auto" }}>
                      {item.comments.length === 0 ? (
                        <div style={{ fontSize: "11px", color: "var(--text-dim)", padding: "4px 0" }}>No comments yet. Be the first!</div>
                      ) : (
                        item.comments.map((c, i) => (
                          <div key={i} className="news-page-comment-item">
                            <span className="news-page-comment-author">{c.author}:</span>
                            <span className="news-page-comment-text">{c.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <form onSubmit={(e) => handleAddComment(e, item.id)} className="news-page-comment-form">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        required
                      />
                      <button type="submit">Send</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {toastMsg && (
        <div className="toast-notification">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
