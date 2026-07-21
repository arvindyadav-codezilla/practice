"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ChatMessage {
  type: "message" | "system" | "poll" | "share_code";
  username?: string;
  text?: string;
  content?: string;
  timestamp: string;
  mediaUrl?: string;
  pollId?: string;
  question?: string;
  options?: { option: string; votes: number }[];
  voters?: { [user: string]: string };
  codeLanguage?: string;
  codeSnippet?: string;
}

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

const Whiteboard = ({ socket, connected, username }: { socket: WebSocket | null; connected: boolean; username: string }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [color, setColor] = useState("#a855f7");
  const [lineWidth, setLineWidth] = useState(4);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleRemoteDraw = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      drawOnCanvas(detail.x0, detail.y0, detail.x1, detail.y1, detail.color, detail.width);
    };

    const handleRemoteClear = () => {
      clearLocalCanvas();
    };

    window.addEventListener("whiteboard-draw-event", handleRemoteDraw);
    window.addEventListener("whiteboard-clear-event", handleRemoteClear);

    return () => {
      window.removeEventListener("whiteboard-draw-event", handleRemoteDraw);
      window.removeEventListener("whiteboard-clear-event", handleRemoteClear);
    };
  }, []);

  const drawOnCanvas = (x0: number, y0: number, x1: number, y1: number, drawColor: string, drawWidth: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearCanvas = () => {
    clearLocalCanvas();
    if (socket && connected) {
      socket.send(JSON.stringify({ type: "clear_canvas" }));
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    isDrawingRef.current = true;
    lastPosRef.current = coords;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const x0 = lastPosRef.current.x;
    const y0 = lastPosRef.current.y;
    const x1 = coords.x;
    const y1 = coords.y;

    drawOnCanvas(x0, y0, x1, y1, color, lineWidth);

    if (socket && connected) {
      socket.send(
        JSON.stringify({
          type: "draw",
          x0,
          y0,
          x1,
          y1,
          color,
          width: lineWidth,
          username,
        })
      );
    }

    lastPosRef.current = coords;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "16px", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ color: "#fff", margin: 0, fontSize: "20px", fontWeight: 700 }}>Real-time Whiteboard</h2>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "12px" }}>Draw and brainstorm collaboratively with room members</p>
        </div>
        <button onClick={handleClearCanvas} className="news-page-action-btn like" style={{ padding: "8px 16px", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
          🧹 Clear Canvas
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-main)" }}>Color:</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ border: "none", background: "none", width: "32px", height: "32px", cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
          <span style={{ fontSize: "13px", color: "var(--text-main)" }}>Width:</span>
          <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} style={{ flex: 1, accentColor: "#a855f7" }} />
          <span style={{ fontSize: "13px", color: "var(--text-muted)", minWidth: "24px" }}>{lineWidth}px</span>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", background: "#090d16", borderRadius: "16px", border: "1px solid var(--panel-border)", overflow: "hidden", minHeight: "350px" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
        />
      </div>
    </div>
  );
};

const CodeSandbox = ({ html, css, js, onHtmlChange, onCssChange, onJsChange, onShare }: {
  html: string;
  css: string;
  js: string;
  onHtmlChange: (val: string) => void;
  onCssChange: (val: string) => void;
  onJsChange: (val: string) => void;
  onShare: () => void;
}) => {
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [activeLang, setActiveLang] = useState<"html" | "css" | "js">("html");

  const generateSource = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${css}</style>
        </head>
        <body>
          ${html}
          <script>${js}</script>
        </body>
      </html>
    `;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "16px", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ color: "#fff", margin: 0, fontSize: "20px", fontWeight: 700 }}>Code Sandbox Playground</h2>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "12px" }}>Write frontend snippets and share them directly into the chat</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onShare} className="back-to-chat-btn" style={{ background: "var(--primary-gradient)", border: "none", boxShadow: "0 4px 12px var(--primary-glow)", fontSize: "12px", padding: "8px 16px" }}>
            🚀 Share to Chat
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
        <button onClick={() => setView("editor")} style={{ background: view === "editor" ? "rgba(255,255,255,0.06)" : "none", border: "none", color: "#fff", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" }}>
          📝 Editor
        </button>
        <button onClick={() => setView("preview")} style={{ background: view === "preview" ? "rgba(255,255,255,0.06)" : "none", border: "none", color: "#fff", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" }}>
          👁️ Live Preview
        </button>
      </div>

      {view === "editor" ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "12px", minHeight: "350px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {(["html", "css", "js"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                style={{
                  background: activeLang === lang ? "rgba(168, 85, 247, 0.15)" : "none",
                  border: activeLang === lang ? "1px solid var(--primary)" : "1px solid transparent",
                  color: activeLang === lang ? "var(--primary)" : "var(--text-muted)",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase"
                }}
              >
                {lang}
              </button>
            ))}
          </div>

          <textarea
            value={activeLang === "html" ? html : activeLang === "css" ? css : js}
            onChange={(e) => {
              if (activeLang === "html") onHtmlChange(e.target.value);
              else if (activeLang === "css") onCssChange(e.target.value);
              else onJsChange(e.target.value);
            }}
            style={{
              flex: 1,
              background: "#090d16",
              border: "1px solid var(--panel-border)",
              borderRadius: "12px",
              padding: "16px",
              color: "#38bdf8",
              fontFamily: "monospace",
              fontSize: "13px",
              lineHeight: "1.6",
              outline: "none",
              resize: "none"
            }}
            placeholder={`Type your ${activeLang.toUpperCase()} code here...`}
          />
        </div>
      ) : (
        <div style={{ flex: 1, background: "#fff", borderRadius: "12px", border: "1px solid var(--panel-border)", overflow: "hidden", minHeight: "350px" }}>
          <iframe
            srcDoc={generateSource()}
            title="Sandbox Live Preview"
            sandbox="allow-scripts"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      )}
    </div>
  );
};

const SynthLoops = ({ socket, connected, username, initialGrid }: { socket: WebSocket | null; connected: boolean; username: string; initialGrid?: number[][] }) => {
  const [grid, setGrid] = useState<number[][]>(initialGrid || Array(8).fill(null).map(() => Array(8).fill(0)));
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stepTimerRef = useRef<any>(null);

  // Setup sound synthesizer notes
  const notes = [1046.50, 880.00, 783.99, 659.25, 587.33, 523.25]; // C6, A5, G5, E5, D5, C5

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data.type === "synth_update") {
        setGrid(prev => {
          const next = prev.map(row => [...row]);
          next[data.row][data.col] = data.state;
          return next;
        });
      } else if (data.type === "games_sync" && data.synth) {
        setGrid(data.synth);
      }
    };
    window.addEventListener("playground-event", handleEvent);
    return () => window.removeEventListener("playground-event", handleEvent);
  }, []);

  const toggleCell = (row: number, col: number) => {
    if (socket && connected) {
      socket.send(JSON.stringify({ type: "synth_toggle", row, col }));
    }
  };

  const playNote = (frequency: number, type: OscillatorType, duration: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context init blocked or failed: ", e);
    }
  };

  const playDrum = (isSnare: boolean) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      if (!isSnare) {
        // Kick Drum
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Snare Drum (White Noise + Bandpass Filter)
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1000;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        noise.start();
        noise.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn("Audio Context init blocked or failed: ", e);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const stepInterval = 250; // ms per step (120 BPM)
      stepTimerRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const next = (prev + 1) % 8;
          // Play any active notes on this step
          for (let row = 0; row < 8; row++) {
            if (grid[row][next] === 1) {
              if (row < 6) {
                playNote(notes[row], "sine", 0.25);
              } else if (row === 6) {
                playDrum(false); // Kick
              } else if (row === 7) {
                playDrum(true); // Snare
              }
            }
          }
          return next;
        });
      }, stepInterval);
    } else {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [isPlaying, grid]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", padding: "20px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: 700 }}>🎵 Synth Sequencer</h3>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Toggle cells to co-create loops with other room members in real-time!</p>
        </div>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            background: isPlaying ? "#ef4444" : "var(--primary-gradient)",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            fontWeight: 600,
            padding: "8px 16px",
            cursor: "pointer"
          }}
        >
          {isPlaying ? "⏹ Stop Sequencer" : "▶ Start Sequencer"}
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: "12px",
        background: "rgba(255,255,255,0.02)",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto"
      }}>
        {/* Labels Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "space-around" }}>
          {["Synth C6", "Synth A5", "Synth G5", "Synth E5", "Synth D5", "Synth C5", "Kick Drum", "Snare Drum"].map((lbl, idx) => (
            <div key={idx} style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, height: "35px", display: "flex", alignItems: "center" }}>
              {lbl}
            </div>
          ))}
        </div>

        {/* Matrix Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "350px" }}>
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: "flex", gap: "8px" }}>
              {row.map((cell, colIdx) => {
                const isActive = cell === 1;
                const isCurrent = currentStep === colIdx && isPlaying;
                return (
                  <button
                    key={colIdx}
                    onClick={() => toggleCell(rowIdx, colIdx)}
                    style={{
                      flex: 1,
                      height: "35px",
                      background: isActive 
                        ? (rowIdx < 6 ? "var(--primary-gradient)" : "linear-gradient(135deg, #3b82f6, #1d4ed8)") 
                        : isCurrent 
                          ? "rgba(255,255,255,0.12)" 
                          : "rgba(255,255,255,0.03)",
                      border: isCurrent 
                        ? "1px solid #fff" 
                        : isActive 
                          ? "none" 
                          : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      boxShadow: isActive ? "0 0 10px rgba(168, 85, 247, 0.4)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CodeRacer = ({ socket, connected, username }: { socket: WebSocket | null; connected: boolean; username: string }) => {
  const [snippet, setSnippet] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, { percent: number; wpm: number }>>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data.type === "racer_init") {
        setSnippet(data.snippet);
        setInputVal("");
        setIsPlaying(true);
        setStartTime(Date.now());
        setProgressMap({});
        setLeaderboard([]);
      } else if (data.type === "racer_update") {
        setProgressMap(data.progress);
      } else if (data.type === "racer_leaderboard") {
        setLeaderboard(data.finished);
      } else if (data.type === "games_sync" && data.racer_snippet) {
        setSnippet(data.racer_snippet);
      }
    };
    window.addEventListener("playground-event", handleEvent);
    return () => window.removeEventListener("playground-event", handleEvent);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputVal(val);

    if (!isPlaying || !startTime) return;

    // Calculate progress
    let correctChars = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === snippet[i]) {
        correctChars++;
      } else {
        break;
      }
    }

    const percent = Math.round((correctChars / snippet.length) * 100);
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const wpm = elapsedMinutes > 0 ? Math.round((correctChars / 5) / elapsedMinutes) : 0;

    // Send progress
    if (socket && connected) {
      socket.send(JSON.stringify({ type: "racer_progress", progress: percent, wpm }));

      // Check if finished
      if (correctChars === snippet.length && val.length === snippet.length) {
        setIsPlaying(false);
        const finalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        socket.send(JSON.stringify({ type: "racer_finished", wpm, time: parseFloat(finalTime) }));
      }
    }
  };

  const startRace = () => {
    if (socket && connected) {
      socket.send(JSON.stringify({ type: "racer_start" }));
    }
  };

  const renderSnippet = () => {
    return snippet.split("").map((char, idx) => {
      let color = "var(--text-muted)";
      let background = "transparent";
      if (idx < inputVal.length) {
        if (inputVal[idx] === char) {
          color = "#10b981";
        } else {
          color = "#ef4444";
          background = "rgba(239, 68, 68, 0.15)";
        }
      }
      return (
        <span key={idx} style={{ color, background, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {char}
        </span>
      );
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", padding: "20px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: 700 }}>🏎️ Code Racer</h3>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Race to type the code block correctly. WPM updates in real-time!</p>
        </div>
        {!isPlaying && (
          <button
            onClick={startRace}
            style={{
              background: "var(--primary-gradient)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontWeight: 600,
              padding: "8px 16px",
              cursor: "pointer"
            }}
          >
            🏁 Start New Race
          </button>
        )}
      </div>

      {snippet ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          {/* Typing Area */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "#090d16",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.06)",
              minHeight: "150px",
              fontFamily: "monospace",
              fontSize: "14px",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap"
            }}>
              {renderSnippet()}
            </div>

            <textarea
              value={inputVal}
              onChange={handleInputChange}
              disabled={!isPlaying}
              placeholder={isPlaying ? "Type the code snippet above exactly as shown..." : "Click Start New Race to begin!"}
              style={{
                width: "100%",
                height: "120px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                padding: "12px",
                color: "#fff",
                fontSize: "14px",
                fontFamily: "monospace",
                resize: "none",
                outline: "none"
              }}
            />
          </div>

          {/* Race Tracks & Live Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="glass-card" style={{ padding: "16px", background: "rgba(255,255,255,0.02)" }}>
              <h4 style={{ margin: "0 0 12px 0", color: "#fff", fontSize: "14px", fontWeight: 600 }}>Live Competitors</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(progressMap).map(([user, data]) => (
                  <div key={user} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{user}</span>
                      <span>{data.wpm} WPM ({data.percent}%)</span>
                    </div>
                    <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${data.percent}%`, background: "var(--primary-gradient)", transition: "width 0.2s" }} />
                    </div>
                  </div>
                ))}
                {Object.keys(progressMap).length === 0 && (
                  <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>No active racers.</span>
                )}
              </div>
            </div>

            {leaderboard.length > 0 && (
              <div className="glass-card" style={{ padding: "16px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#10b981", fontSize: "14px", fontWeight: 600 }}>Leaderboard Results</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {leaderboard.map((res, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#fff" }}>
                      <span>{idx + 1}. {res.username}</span>
                      <span style={{ fontWeight: 600 }}>{res.wpm} WPM ({res.time}s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)" }}>
          No active race. Click the button to start!
        </div>
      )}
    </div>
  );
};

const TriviaDuel = ({ socket, connected, username }: { socket: WebSocket | null; connected: boolean; username: string }) => {
  const [gameState, setGameState] = useState<"lobby" | "question" | "results">("lobby");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [totalQ, setTotalQ] = useState(5);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data.type === "trivia_next") {
        setGameState("question");
        setQuestion(data.question);
        setOptions(data.options);
        setQIndex(data.index);
        setTotalQ(data.total);
        setTimeLeft(15);
        setSelectedOpt(null);
        setCorrectIdx(null);
      } else if (data.type === "trivia_reveal") {
        setCorrectIdx(data.correctIndex);
        setScores(data.scores);
      } else if (data.type === "trivia_end") {
        setGameState("results");
        setScores(data.scores);
      }
    };
    window.addEventListener("playground-event", handleEvent);
    return () => window.removeEventListener("playground-event", handleEvent);
  }, []);

  useEffect(() => {
    if (gameState === "question" && timeLeft > 0 && correctIdx === null) {
      const t = setTimeout(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (socket && connected && qIndex === 0) {
              socket.send(JSON.stringify({ type: "trivia_reveal_request" }));
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [gameState, timeLeft, correctIdx]);

  const startQuiz = () => {
    if (socket && connected) {
      socket.send(JSON.stringify({ type: "trivia_start" }));
    }
  };

  const submitAnswer = (optIdx: number) => {
    if (selectedOpt !== null || correctIdx !== null) return;
    setSelectedOpt(optIdx);
    const timeTaken = 15 - timeLeft;
    if (socket && connected) {
      socket.send(JSON.stringify({
        type: "trivia_submit",
        index: qIndex,
        optionIndex: optIdx,
        timeTaken
      }));
    }
  };

  const nextQuestion = () => {
    if (socket && connected) {
      socket.send(JSON.stringify({ type: "trivia_next_request" }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", padding: "20px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: 700 }}>🧠 AI Tech Trivia</h3>
          <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "12px" }}>Race to answer technical coding quiz questions correct and fast!</p>
        </div>
        {gameState === "lobby" && (
          <button
            onClick={startQuiz}
            style={{
              background: "var(--primary-gradient)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontWeight: 600,
              padding: "8px 16px",
              cursor: "pointer"
            }}
          >
            ⚡ Start Trivia Battle
          </button>
        )}
      </div>

      {gameState === "question" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          {/* Question Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              color: "var(--text-muted)"
            }}>
              <span>Question {qIndex + 1} of {totalQ}</span>
              <span style={{
                color: timeLeft > 5 ? "#a855f7" : "#ef4444",
                fontWeight: 700,
                fontSize: "16px"
              }}>
                ⏱ {timeLeft}s
              </span>
            </div>

            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              color: "#fff",
              fontSize: "18px",
              fontWeight: 600,
              lineHeight: "1.4"
            }}>
              {question}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {options.map((opt, idx) => {
                const isSelected = selectedOpt === idx;
                const isCorrect = correctIdx === idx;
                const isWrong = correctIdx !== null && isSelected && !isCorrect;

                return (
                  <button
                    key={idx}
                    onClick={() => submitAnswer(idx)}
                    disabled={selectedOpt !== null || correctIdx !== null}
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "10px",
                      textAlign: "left",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                      background: isCorrect 
                        ? "#10b981" 
                        : isWrong 
                          ? "#ef4444" 
                          : isSelected 
                            ? "var(--primary-gradient)" 
                            : "rgba(255,255,255,0.03)",
                      border: isCorrect || isWrong || isSelected 
                        ? "none" 
                        : "1px solid rgba(255,255,255,0.06)",
                      color: isCorrect || isWrong || isSelected ? "#fff" : "var(--text-muted)",
                      transition: "all 0.2s"
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {correctIdx !== null && (
              <button
                onClick={nextQuestion}
                style={{
                  background: "var(--primary-gradient)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "10px 20px",
                  cursor: "pointer",
                  alignSelf: "flex-end"
                }}
              >
                {qIndex + 1 === totalQ ? "Finish Battle" : "Next Question ➔"}
              </button>
            )}
          </div>

          {/* Scores Panel */}
          <div className="glass-card" style={{ padding: "20px", background: "rgba(255, 255, 255, 0.02)" }}>
            <h4 style={{ margin: "0 0 16px 0", color: "#fff", fontSize: "14px", fontWeight: 700 }}>Battle Scores</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([user, score], idx) => (
                <div key={user} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#fff" }}>
                    {idx === 0 ? "👑 " : ""}{user}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--primary)" }}>{score} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {gameState === "results" && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          padding: "40px 0"
        }}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: "28px", fontWeight: 800 }}>🏆 Final Podium</h2>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
            maxWidth: "400px"
          }}>
            {Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([user, score], idx) => (
              <div
                key={user}
                className="glass-card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px",
                  border: idx === 0 ? "1px solid var(--primary)" : "1px solid rgba(255,255,255,0.06)"
                }}
              >
                <span style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>
                  {idx === 0 ? "🥇 " : idx === 1 ? "🥈 " : idx === 2 ? "🥉 " : ""}{user}
                </span>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{score} pts</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setGameState("lobby")}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              color: "#fff",
              fontWeight: 600,
              padding: "10px 20px",
              cursor: "pointer",
              marginTop: "16px"
            }}
          >
            Back to Lobby
          </button>
        </div>
      )}
    </div>
  );
};

const Playground = ({ socket, connected, username }: { socket: WebSocket | null; connected: boolean; username: string }) => {
  const [activeGame, setActiveGame] = useState<"lobby" | "racer" | "trivia" | "synth">("lobby");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflowY: "auto" }}>
      {activeGame !== "lobby" && (
        <button
          onClick={() => setActiveGame("lobby")}
          style={{
            background: "none",
            border: "none",
            color: "var(--primary)",
            fontWeight: 600,
            fontSize: "12px",
            cursor: "pointer",
            padding: "20px 20px 0",
            width: "fit-content"
          }}
        >
          🡨 Back to Playground Lobby
        </button>
      )}

      {activeGame === "lobby" ? (
        <div style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <h2 style={{ margin: 0, color: "#fff", fontSize: "24px", fontWeight: 800 }}>🎮 Synapse Playground</h2>
            <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "14px" }}>Choose an interactive real-time multiplayer game to play with room members!</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            {/* Code Racer Card */}
            <div
              onClick={() => setActiveGame("racer")}
              className="glass-card"
              style={{
                padding: "24px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: "1px solid rgba(168, 85, 247, 0.15)",
                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.03), rgba(255, 255, 255, 0.01))"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(168, 85, 247, 0.15)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>🏎️</div>
              <h3 style={{ margin: "0 0 8px 0", color: "#fff", fontSize: "18px", fontWeight: 700 }}>Code Racer</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.5" }}>
                Race against other users in the room to type standard code snippets. Shows real-time progress tracks and WPM rankings!
              </p>
            </div>

            {/* AI Trivia Duel Card */}
            <div
              onClick={() => setActiveGame("trivia")}
              className="glass-card"
              style={{
                padding: "24px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: "1px solid rgba(59, 130, 246, 0.15)",
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.03), rgba(255, 255, 255, 0.01))"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.15)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>🧠</div>
              <h3 style={{ margin: "0 0 8px 0", color: "#fff", fontSize: "18px", fontWeight: 700 }}>AI Tech Trivia</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.5" }}>
                Compete in rapid multiple-choice trivia challenges covering JavaScript, system design, and complexity logic.
              </p>
            </div>

            {/* Synth Loops Card */}
            <div
              onClick={() => setActiveGame("synth")}
              className="glass-card"
              style={{
                padding: "24px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                border: "1px solid rgba(16, 185, 129, 0.15)",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.03), rgba(255, 255, 255, 0.01))"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#10b981";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.15)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>🎵</div>
              <h3 style={{ margin: "0 0 8px 0", color: "#fff", fontSize: "18px", fontWeight: 700 }}>Synth Loop Sequencer</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.5" }}>
                Co-create rhythmic sound patterns on a collaborative 8-step matrix. Changes synchronize instantly for all room listeners!
              </p>
            </div>
          </div>
        </div>
      ) : activeGame === "racer" ? (
        <CodeRacer socket={socket} connected={connected} username={username} />
      ) : activeGame === "trivia" ? (
        <TriviaDuel socket={socket} connected={connected} username={username} />
      ) : (
        <SynthLoops socket={socket} connected={connected} username={username} />
      )}
    </div>
  );
};

interface Campaign {
  id: string;
  content: string;
  whatsapp_number: string;
  posts: string[];
  created_at: string;
  approved_post_index: number | null;
  approved_at: string | null;
  status: "pending" | "published";
  whatsapp_outbox_log: { timestamp: string; message: string; status: string }[];
  fb_published_id: string | null;
  ig_published_id: string | null;
}

const SocialHub = ({ serverUrl }: { serverUrl: string }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("+919876543210");
  const [generating, setGenerating] = useState(false);
  const [activeSimCampaign, setActiveSimCampaign] = useState<Campaign | null>(null);
  const [simReply, setSimReply] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<Record<string, "facebook" | "instagram">>({});

  const getHttpUrl = (path: string) => {
    try {
      const url = new URL(serverUrl);
      const protocol = url.protocol === "wss:" ? "https:" : "http:";
      return `${protocol}//${url.host}${path}`;
    } catch {
      return "";
    }
  };

  const loadCampaigns = async () => {
    const url = getHttpUrl("/api/campaigns");
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCampaigns(data);
        const pending = data.find(c => c.status === "pending");
        if (pending) setActiveSimCampaign(pending);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverUrl) {
      loadCampaigns();
    }
  }, [serverUrl]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !whatsappNumber.trim()) return;

    const url = getHttpUrl("/api/campaigns");
    if (!url) return;

    setGenerating(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, whatsapp_number: whatsappNumber })
      });
      const data = await res.json();
      if (data.status === "ok") {
        setCampaigns(prev => [data.campaign, ...prev]);
        setActiveSimCampaign(data.campaign);
        setContent("");
        showToast("Campaign generated & WhatsApp notification sent!");
      }
    } catch (err) {
      console.error(err);
      showToast("Error creating campaign.");
    } finally {
      setGenerating(false);
    }
  };

  const handleApprovePost = async (campaignId: string, postIndex: number) => {
    const url = getHttpUrl(`/api/campaigns/${campaignId}/approve`);
    if (!url) return;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_index: postIndex })
      });
      const data = await res.json();
      if (data.status === "ok") {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? data.campaign : c));
        if (activeSimCampaign?.id === campaignId) {
          setActiveSimCampaign(data.campaign);
        }
        showToast(`Post #${postIndex + 1} published to Facebook and Instagram!`);
      } else {
        showToast(data.message || "Failed to publish.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error approving campaign.");
    }
  };

  const handleSimulateWhatsAppReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simReply.trim() || !activeSimCampaign) return;

    const url = getHttpUrl("/api/webhook/whatsapp");
    if (!url) return;

    setSimulating(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: activeSimCampaign.whatsapp_number,
          Body: simReply
        })
      });
      const data = await res.json();
      if (data.status === "ok") {
        showToast(`WhatsApp command accepted! Post #${data.approved_post_index + 1} Approved.`);
        setSimReply("");
        loadCampaigns();
      } else {
        showToast(data.message || "Failed to simulate message.");
      }
    } catch (err) {
      console.error(err);
      showToast("Simulation API error.");
    } finally {
      setSimulating(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const togglePreviewPlatform = (campaignId: string, platform: "facebook" | "instagram") => {
    setPreviewPlatform(prev => ({
      ...prev,
      [campaignId]: platform
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflowY: "auto", padding: "24px", gap: "24px", textAlign: "left", background: "linear-gradient(180deg, rgba(15, 12, 30, 0.3) 0%, rgba(9, 5, 20, 0.3) 100%)" }}>
      
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ color: "#fff", margin: 0, fontSize: "22px", fontWeight: 800, background: "linear-gradient(135deg, #fff 0%, #a855f7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            📢 Social Campaigns & Approval Hub
          </h2>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: "13px" }}>
            Turn concepts into production-ready social media posts, verify them on mock platforms, and trigger WhatsApp approval workflows.
          </p>
        </div>
        <button 
          onClick={loadCampaigns} 
          className="news-page-action-btn comment"
          style={{ padding: "8px 16px", borderRadius: "10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#fff" }}
        >
          🔄 Refresh Feeds
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "28px", alignItems: "start" }}>
        
        {/* Left column: Create Panel & Phone Mockup Sandbox */}
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          
          {/* Create Campaign Box */}
          <div className="glass-card" style={{ padding: "24px", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>⚡</span>
              <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: 700 }}>Initialize Campaign</h3>
            </div>
            
            <form onSubmit={handleCreateCampaign} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label className="form-label" style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 700 }}>Source Text / Article</label>
                <textarea
                  placeholder="Paste prompt, technical details, or article text to generate posts..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  style={{
                    height: "120px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "12px",
                    padding: "12px",
                    color: "#fff",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    resize: "none",
                    outline: "none",
                    lineHeight: "1.5",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label className="form-label" style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 700 }}>Admin Notification WhatsApp</label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  required
                  style={{
                    height: "42px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "12px",
                    padding: "0 14px",
                    color: "#fff",
                    fontSize: "13px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                />
              </div>

              <button
                type="submit"
                disabled={generating}
                style={{
                  height: "44px",
                  background: "var(--primary-gradient)",
                  border: "none",
                  borderRadius: "12px",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px var(--primary-glow)",
                  opacity: generating ? 0.7 : 1,
                  transition: "all 0.2s"
                }}
              >
                {generating ? "✨ Generating 5 Custom Posts..." : "🚀 Launch & Send to WhatsApp"}
              </button>
            </form>
          </div>

          {/* WhatsApp Interactive Mockup Phone */}
          <div style={{
            background: "#0c1317",
            borderRadius: "32px",
            border: "8px solid #2d3134",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "450px",
            position: "relative"
          }}>
            {/* Phone Top Notch Speaker */}
            <div style={{ height: "20px", background: "#2d3134", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div style={{ width: "60px", height: "4px", background: "#111", borderRadius: "2px" }} />
            </div>

            {/* WhatsApp Header */}
            <div style={{ background: "#202c33", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🤖</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "#e9edef", margin: 0 }}>Synapse Approval Bot</div>
                <div style={{ fontSize: "10px", color: "#8696a0", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00e676", display: "inline-block" }}></span>
                  Online
                </div>
              </div>
            </div>

            {/* WhatsApp Chat Body */}
            <div style={{
              flex: 1,
              background: "#0b141a",
              backgroundImage: "radial-gradient(rgba(10, 20, 30, 0.8) 20%, transparent 20%)",
              backgroundSize: "16px 16px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              overflowY: "auto"
            }}>
              <div style={{ alignSelf: "center", background: "#182229", color: "#8696a0", fontSize: "9px", padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Today
              </div>

              {activeSimCampaign ? (
                <>
                  {/* WhatsApp Sent Approval Message */}
                  <div style={{
                    alignSelf: "flex-start",
                    background: "#202c33",
                    color: "#e9edef",
                    borderRadius: "0px 10px 10px 10px",
                    padding: "10px 12px",
                    maxWidth: "85%",
                    fontSize: "12px",
                    lineHeight: "1.45",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    position: "relative"
                  }}>
                    <pre style={{
                      margin: 0,
                      fontFamily: "inherit",
                      whiteSpace: "pre-wrap",
                      color: "#e9edef"
                    }}>
                      {activeSimCampaign.whatsapp_outbox_log[0]?.message || "System error sending notification."}
                    </pre>
                    <span style={{ fontSize: "8px", color: "#8696a0", float: "right", marginTop: "4px" }}>
                      {activeSimCampaign.created_at ? new Date(activeSimCampaign.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                  </div>

                  {/* Confirmation Message if Published */}
                  {activeSimCampaign.status === "published" && (
                    <div style={{
                      alignSelf: "flex-start",
                      background: "#202c33",
                      color: "#e9edef",
                      borderRadius: "0px 10px 10px 10px",
                      padding: "10px 12px",
                      maxWidth: "85%",
                      fontSize: "12px",
                      lineHeight: "1.45",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)"
                    }}>
                      <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap", color: "#e9edef" }}>
                        {activeSimCampaign.whatsapp_outbox_log[1]?.message || "✅ Selected post idea approved and published!"}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ alignSelf: "center", color: "#667781", fontSize: "11px", marginTop: "40px" }}>
                  Awaiting campaign initiation to launch chat logs.
                </div>
              )}
            </div>

            {/* WhatsApp Text Input Footer */}
            <form onSubmit={handleSimulateWhatsAppReply} style={{ background: "#202c33", padding: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                disabled={!activeSimCampaign || activeSimCampaign.status !== "pending"}
                placeholder={activeSimCampaign && activeSimCampaign.status === "pending" ? "Type 'Approve <number>' to verify..." : "WhatsApp chat locked"}
                value={simReply}
                onChange={(e) => setSimReply(e.target.value)}
                style={{
                  flex: 1,
                  height: "38px",
                  background: "#2a3942",
                  border: "none",
                  borderRadius: "20px",
                  padding: "0 16px",
                  color: "#e9edef",
                  fontSize: "13px",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                disabled={simulating || !activeSimCampaign || activeSimCampaign.status !== "pending"}
                style={{
                  width: "38px",
                  height: "38px",
                  background: "#00a884",
                  borderRadius: "50%",
                  border: "none",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  opacity: (!activeSimCampaign || activeSimCampaign.status !== "pending") ? 0.5 : 1
                }}
              >
                ➔
              </button>
            </form>
          </div>

        </div>

        {/* Right column: Active Campaigns Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <h3 style={{ margin: "0 0 4px 0", color: "#fff", fontSize: "17px", fontWeight: 700 }}>Campaign Pipeline</h3>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--text-dim)" }}>
              Fetching campaigns feed...
            </div>
          ) : campaigns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--text-dim)", background: "rgba(255,255,255,0.01)", borderRadius: "20px", border: "1px dashed rgba(255,255,255,0.06)" }}>
              No social campaigns generated yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {campaigns.map((camp) => {
                const isPending = camp.status === "pending";
                const activePlatform = previewPlatform[camp.id] || "facebook";
                
                return (
                  <div key={camp.id} className="glass-card" style={{ padding: "24px", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 10px 40px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", gap: "20px" }}>
                    
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff", letterSpacing: "0.5px" }}>ID: {camp.id.toUpperCase()}</span>
                          <span style={{
                            fontSize: "10px",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            background: isPending ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                            color: isPending ? "#fbbf24" : "#34d399",
                            border: isPending ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)"
                          }}>
                            {isPending ? "⏳ Pending Approval" : "✅ Published"}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px" }}>
                          Created: {new Date(camp.created_at).toLocaleString()} | Mobile Admin: {camp.whatsapp_number}
                        </div>
                      </div>

                      {/* Mockup Preview Platform Selector */}
                      <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "4px", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <button
                          onClick={() => togglePreviewPlatform(camp.id, "facebook")}
                          style={{
                            background: activePlatform === "facebook" ? "rgba(129, 140, 248, 0.15)" : "none",
                            border: activePlatform === "facebook" ? "1px solid rgba(129,140,248,0.2)" : "1px solid transparent",
                            borderRadius: "8px",
                            color: activePlatform === "facebook" ? "#a5b4fc" : "var(--text-muted)",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "6px 12px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          🌐 Facebook
                        </button>
                        <button
                          onClick={() => togglePreviewPlatform(camp.id, "instagram")}
                          style={{
                            background: activePlatform === "instagram" ? "rgba(129, 140, 248, 0.15)" : "none",
                            border: activePlatform === "instagram" ? "1px solid rgba(129,140,248,0.2)" : "1px solid transparent",
                            borderRadius: "8px",
                            color: activePlatform === "instagram" ? "#a5b4fc" : "var(--text-muted)",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "6px 12px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          📸 Instagram
                        </button>
                      </div>
                    </div>

                    {/* Original Base Content Box */}
                    <div style={{ background: "rgba(255,255,255,0.01)", borderRadius: "10px", padding: "12px 16px", border: "1px solid rgba(255,255,255,0.03)", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      <strong style={{ color: "var(--text-main)" }}>Campaign Source Prompt:</strong> "{camp.content}"
                    </div>

                    {/* Candidate Posts List / Selected Post Preview */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <label style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 800, letterSpacing: "0.5px" }}>AI COPYWRITER OPTIONS</label>
                      
                      {camp.posts.map((post, idx) => {
                        const isChosen = camp.approved_post_index === idx;
                        const cardBg = isChosen 
                          ? "rgba(16, 185, 129, 0.03)" 
                          : isPending 
                            ? "rgba(255, 255, 255, 0.01)" 
                            : "rgba(255,255,255,0.005)";
                        const borderStyle = isChosen 
                          ? "1px solid rgba(16, 185, 129, 0.4)" 
                          : "1px solid rgba(255,255,255,0.04)";
                          
                        return (
                          <div
                            key={idx}
                            style={{
                              background: cardBg,
                              border: borderStyle,
                              borderRadius: "16px",
                              padding: "18px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              opacity: !isPending && !isChosen ? 0.35 : 1,
                              transition: "all 0.2s"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: isChosen ? "#34d399" : "#a855f7" }}>
                                {isChosen ? "❇️ SELECTED & PUBLISHED" : `Post Template #${idx + 1}`}
                              </span>
                              
                              {isPending && (
                                <button
                                  onClick={() => handleApprovePost(camp.id, idx)}
                                  className="back-to-chat-btn"
                                  style={{
                                    background: "rgba(129, 140, 248, 0.1)",
                                    border: "1px solid var(--primary)",
                                    boxShadow: "none",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    padding: "6px 12px"
                                  }}
                                >
                                  Approve Option
                                </button>
                              )}
                            </div>

                            {/* Render Mockup Container vs Text */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {activePlatform === "facebook" ? (
                                /* FB Layout Mock */
                                <div style={{ background: "#18191a", border: "1px solid #3e4042", borderRadius: "12px", padding: "16px", fontFamily: "sans-serif" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--primary-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold", color: "#fff" }}>S</div>
                                    <div>
                                      <div style={{ fontSize: "13px", fontWeight: "bold", color: "#e4e6eb" }}>Synapse Global</div>
                                      <div style={{ fontSize: "10px", color: "#b0b3b8" }}>Just now • 🌐</div>
                                    </div>
                                  </div>
                                  <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#e4e6eb", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{post}</p>
                                  
                                  {/* FB Engagement bar */}
                                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #3e4042", paddingTop: "8px", fontSize: "12px", color: "#b0b3b8", fontWeight: 600 }}>
                                    <span>👍 Like</span>
                                    <span>💬 Comment</span>
                                    <span>📤 Share</span>
                                  </div>
                                </div>
                              ) : (
                                /* IG Layout Mock */
                                <div style={{ background: "#000", border: "1px solid #262626", borderRadius: "12px", padding: "16px", fontFamily: "sans-serif" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5px" }}>
                                      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", color: "#fff" }}>S</div>
                                    </div>
                                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "#fff" }}>synapse_platform</span>
                                  </div>
                                  <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#fff", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                                    <strong style={{ marginRight: "6px" }}>synapse_platform</strong>{post}
                                  </p>
                                  
                                  {/* IG Engagement bar */}
                                  <div style={{ display: "flex", gap: "14px", borderTop: "1px solid #262626", paddingTop: "10px", fontSize: "14px" }}>
                                    <span>❤️</span>
                                    <span>💬</span>
                                    <span>📤</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Published Details receipt */}
                    {!isPending && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(16, 185, 129, 0.02)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "16px", padding: "18px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#34d399", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>🏆</span> META GRAPH PUBLISHING RECEIPT
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                          <div>
                            <strong>Facebook API Post ID:</strong> <div style={{ fontFamily: "monospace", color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: "6px", display: "inline-block", marginTop: "4px" }}>{camp.fb_published_id}</div>
                          </div>
                          <div>
                            <strong>Instagram Node ID:</strong> <div style={{ fontFamily: "monospace", color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: "6px", display: "inline-block", marginTop: "4px" }}>{camp.ig_published_id}</div>
                          </div>
                          <div>
                            <strong>Approved At:</strong> <div style={{ color: "#fff", marginTop: "4px" }}>{camp.approved_at ? new Date(camp.approved_at).toLocaleString() : ""}</div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {toast && (
        <div className="toast-notification" style={{ background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", boxShadow: "0 10px 25px rgba(168, 85, 247, 0.3)" }}>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default function GroupChat() {
  // Connection states
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("Dev Lounge");
  const [customRoom, setCustomRoom] = useState("");
  
  // Advanced WS Server Connection Configuration
  const [serverUrl, setServerUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Chatting states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeTyping, setActiveTyping] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "whiteboard" | "sandbox" | "playground" | "social">("chat");

  // Interactive Poll Builder states
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Code Sandbox states
  const [htmlCode, setHtmlCode] = useState("<h3>Welcome to Synapse Sandbox!</h3>\n<p>Edit HTML, CSS, or JS and run it instantly.</p>\n<button id='action-btn'>Click Me</button>");
  const [cssCode, setCssCode] = useState("body {\n  font-family: sans-serif;\n  color: #3b82f6;\n  background: #0f172a;\n  text-align: center;\n  padding-top: 20px;\n}\nbutton {\n  background: linear-gradient(135deg, #a855f7, #3b82f6);\n  color: white;\n  border: none;\n  padding: 8px 16px;\n  border-radius: 6px;\n  cursor: pointer;\n}");
  const [jsCode, setJsCode] = useState("document.getElementById('action-btn').addEventListener('click', () => {\n  alert('Hello from the Sandbox!');\n});");

  const socketRef = useRef<WebSocket | null>(null);

  // Load saved handle and room from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("synapse_username");
      const savedRoom = localStorage.getItem("synapse_room");
      if (savedUser) setUsername(savedUser);
      if (savedRoom) setRoom(savedRoom);
    }
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Suggested popular rooms
  const popularRooms = ["Dev Lounge", "Quantum Lab", "Design Hub", "General Space"];

  // Initialize the server URL on the client-side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname;
      
      // If running locally, connect to local backend; otherwise connect to deployed Render backend
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        setServerUrl(`${protocol}//127.0.0.1:8000/ws`);
      } else {
        setServerUrl(process.env.NEXT_PUBLIC_WS_SERVER_URL || "wss://practice-ihvr.onrender.com/ws");
      }
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTyping]);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Connect to websocket server
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalUsername = username.trim();
    const finalRoom = (customRoom.trim() || room).trim();

    if (!finalUsername || !finalRoom) {
      setErrorMsg("Please enter both username and room name.");
      return;
    }

    if (finalUsername.includes("Nova AI")) {
      setErrorMsg("Username cannot contain 'Nova AI'. That is reserved.");
      return;
    }

    setErrorMsg(null);
    
    try {
      const ws = new WebSocket(serverUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocketConnected(true);
        // Send join event
        ws.send(
          JSON.stringify({
            type: "join",
            username: finalUsername,
            room: finalRoom,
          })
        );
        setJoined(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("synapse_username", finalUsername);
          localStorage.setItem("synapse_room", finalRoom);
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "system") {
          setMessages((prev) => [
            ...prev,
            {
              type: "system",
              content: data.content,
              timestamp: data.timestamp,
            },
          ]);
          if (data.users) {
            setUsers(data.users);
          }
        } else if (data.type === "message") {
          setMessages((prev) => [
            ...prev,
            {
              type: "message",
              username: data.username,
              text: data.text,
              mediaUrl: data.mediaUrl,
              timestamp: data.timestamp,
            },
          ]);
        } else if (data.type === "poll") {
          setMessages((prev) => [
            ...prev,
            {
              type: "poll",
              username: data.username,
              pollId: data.pollId,
              question: data.question,
              options: data.options,
              voters: data.voters || {},
              timestamp: data.timestamp,
            },
          ]);
        } else if (data.type === "poll_update") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.type === "poll" && msg.pollId === data.pollId
                ? { ...msg, options: data.options, voters: data.voters || {} }
                : msg
            )
          );
        } else if (data.type === "share_code") {
          setMessages((prev) => [
            ...prev,
            {
              type: "share_code",
              username: data.username,
              codeLanguage: data.codeLanguage,
              codeSnippet: data.codeSnippet,
              timestamp: data.timestamp,
            },
          ]);
        } else if (data.type === "draw" || data.type === "clear_canvas") {
          if (typeof window !== "undefined") {
            const eventName = data.type === "draw" ? "whiteboard-draw-event" : "whiteboard-clear-event";
            window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
          }
        } else if (data.type === "racer_init" || data.type === "racer_update" || data.type === "racer_leaderboard" || data.type === "trivia_next" || data.type === "trivia_reveal" || data.type === "trivia_end" || data.type === "synth_update" || data.type === "games_sync") {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("playground-event", { detail: data }));
          }
        } else if (data.type === "typing") {
          if (data.isTyping) {
            setActiveTyping(data.username);
          } else {
            setActiveTyping((current) => (current === data.username ? null : current));
          }
        }
      };

      ws.onclose = () => {
        setSocketConnected(false);
        setJoined(false);
        setMessages([]);
        setUsers([]);
        setErrorMsg("Disconnected from server. Please check the backend log or URL.");
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setErrorMsg(`Failed to connect to backend at ${serverUrl}. Is the backend running?`);
      };

    } catch (err) {
      console.error(err);
      setErrorMsg("Invalid WebSocket server URL configured.");
    }
  };

  const handleLeave = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    setJoined(false);
    setMessages([]);
    setUsers([]);
  };

  const castVote = (pollId: string, option: string) => {
    if (socketRef.current && socketConnected) {
      socketRef.current.send(
        JSON.stringify({
          type: "vote",
          pollId,
          option,
        })
      );
    }
  };

  const submitPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = pollQuestion.trim();
    const cleanOptions = pollOptions.map((opt) => opt.trim()).filter((opt) => opt !== "");
    if (!cleanQuestion || cleanOptions.length < 2) return;

    if (socketRef.current && socketConnected) {
      const pollId = "poll_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      socketRef.current.send(
        JSON.stringify({
          type: "poll",
          pollId,
          question: cleanQuestion,
          options: cleanOptions,
        })
      );
      setPollQuestion("");
      setPollOptions(["", ""]);
      setShowCreatePoll(false);
    }
  };

  const shareCodeToChat = () => {
    if (socketRef.current && socketConnected) {
      const fullCode = `<!-- HTML -->\n${htmlCode}\n\n/* CSS */\n${cssCode}\n\n// JS\n${jsCode}`;
      socketRef.current.send(
        JSON.stringify({
          type: "share_code",
          codeLanguage: "html",
          codeSnippet: fullCode,
        })
      );
      setActiveTab("chat");
    }
  };

  const loadSharedCodeIntoSandbox = (fullCode: string) => {
    try {
      const htmlPart = fullCode.match(/<!-- HTML -->\n([\s\S]*?)(?=\n\/\* CSS \*\/|$)/);
      const cssPart = fullCode.match(/\/\* CSS \*\/\n([\s\S]*?)(?=\n\/\/ JS|$)/);
      const jsPart = fullCode.match(/\/\/ JS\n([\s\S]*?)$/);
      
      if (htmlPart) setHtmlCode(htmlPart[1].trim());
      if (cssPart) setCssCode(cssPart[1].trim());
      if (jsPart) setJsCode(jsPart[1].trim());
      
      if (!htmlPart && !cssPart && !jsPart) {
        setHtmlCode(fullCode);
        setCssCode("");
        setJsCode("");
      }
    } catch {
      setHtmlCode(fullCode);
    }
    setActiveTab("sandbox");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socketRef.current || !socketConnected) return;

    // Send chat message
    socketRef.current.send(
      JSON.stringify({
        type: "message",
        text: inputText.trim(),
      })
    );

    // Reset typing status immediately
    sendTypingStatus(false);
    setInputText("");
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (!socketRef.current || !socketConnected) return;
    socketRef.current.send(
      JSON.stringify({
        type: "typing",
        isTyping,
      })
    );
    isTypingRef.current = isTyping;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Handle typing indicator
    if (!isTypingRef.current) {
      sendTypingStatus(true);
    }

    // Reset the typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 1500);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Get initials for profile avatar
  const getInitials = (name: string) => {
    return name.substring(0, 2);
  };

  // Safe client-side markdown formatter
  const renderMessageText = (text: string) => {
    if (!text) return "";
    
    let html = text;
    
    // Escape HTML entities to prevent XSS
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Bullet lists (lines starting with - )
    const lines = html.split("\n").map(line => {
      if (line.trim().startsWith("- ")) {
        return `• ${line.trim().substring(2)}`;
      }
      return line;
    });
    
    return lines.map((str, index) => (
      <React.Fragment key={index}>
        {index > 0 && <br />}
        <span dangerouslySetInnerHTML={{ __html: str }} />
      </React.Fragment>
    ));
  };

  const insertAITrigger = () => {
    if (!inputText.startsWith("@nova")) {
      setInputText((prev) => "@nova " + prev);
    }
  };

  const insertAIDrawTrigger = () => {
    if (!inputText.startsWith("@nova draw")) {
      setInputText((prev) => {
        const trimmed = prev.trim();
        if (trimmed.startsWith("@nova")) {
          return "@nova draw " + trimmed.substring(5).trim();
        }
        return "@nova draw " + trimmed;
      });
    }
  };

  return (
    <div className="app-container">
      {!joined ? (
        /* Lobby Join Form */
        <div className="lobby-container glass-card">
          <div className="lobby-logo">
            <svg viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
            </svg>
          </div>
          
          <h1 className="lobby-title">Synapse Chat</h1>
          <p className="lobby-subtitle">Connect in real-time, instantly.</p>

          <form onSubmit={handleJoin}>
            <div className="form-group">
              <label className="form-label">Choose your Handle</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. cyber_knight"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={15}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Select Group Room</label>
              <div className="room-chips">
                {popularRooms.map((r) => (
                  <div
                    key={r}
                    className={`room-chip ${room === r && !customRoom ? "active" : ""}`}
                    onClick={() => {
                      setRoom(r);
                      setCustomRoom("");
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Or create/enter custom room name..."
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                maxLength={20}
              />
            </div>

            {/* Advanced Configuration Toggle */}
            <div style={{ textAlign: "left", marginBottom: "20px" }}>
              <div 
                style={{ 
                  fontSize: "12px", 
                  color: "var(--text-dim)", 
                  cursor: "pointer", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "4px",
                  fontWeight: 600,
                  userSelect: "none"
                }}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>{showAdvanced ? "▼" : "▶"} Advanced Server Settings</span>
              </div>
              
              {showAdvanced && (
                <div style={{ marginTop: "12px" }}>
                  <label className="form-label" style={{ fontSize: "11px" }}>WebSocket Server URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="ws://127.0.0.1:8000/ws"
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px", display: "block" }}>
                    If you are using port-forwarding or a proxy, enter the external URL here.
                  </span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px", fontWeight: 500 }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="primary-btn">
              <span>Enter Room</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </form>
        </div>
      ) : (
        /* Chat Dashboard */
        <div className="chat-dashboard glass-card">
          {/* Sidebar */}
          <div className="chat-sidebar">
            <div className="sidebar-header" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="app-badge">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
                  </svg>
                </div>
                <span className="app-name">Synapse</span>
              </div>
              <Link href="/news" className="header-icon-link" title="Tech News Feed">
                📰
              </Link>
            </div>

            {/* Sidebar Navigation Tabs */}
            <div style={{ display: "flex", gap: "6px", padding: "0 10px 16px", borderBottom: "1px solid var(--panel-border)" }}>
              {["chat", "whiteboard", "sandbox", "playground", "social"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  style={{
                    flex: 1,
                    background: activeTab === tab ? "var(--primary-gradient)" : "rgba(255,255,255,0.03)",
                    border: activeTab === tab ? "none" : "1px solid rgba(255,255,255,0.06)",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "8px 2px",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {tab === "chat" ? "💬 Chat" : tab === "whiteboard" ? "🎨 Board" : tab === "sandbox" ? "💻 Code" : tab === "playground" ? "🎮 Play" : "📢 Social"}
                </button>
              ))}
            </div>

            <div className="sidebar-section">
              <div className="section-title">
                <span>Room Members</span>
                <span className="badge-count">{users.length}</span>
              </div>
              <div className="users-list">
                {users.map((user, idx) => {
                  const isAI = user.startsWith("Nova AI");
                  return (
                    <div
                      key={idx}
                      className={`user-item ${user === username ? "me" : ""}`}
                    >
                      <div className={`user-avatar ${isAI ? "avatar-ai" : idx % 2 === 0 ? "" : "avatar-alt"}`}>
                        {isAI ? "AI" : getInitials(user)}
                      </div>
                      <span>{isAI ? "Nova AI" : user}</span>
                      {user === username && <span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "4px" }}>(you)</span>}
                      {isAI && <span className="ai-badge">Agent</span>}
                      <div className={`status-dot ${isAI ? "ai-status" : ""}`}></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sidebar-footer">
              <div className="my-profile">
                <div className="user-avatar" style={{ width: "36px", height: "36px", background: "var(--primary-gradient)" }}>
                  {getInitials(username)}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{username}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Online</div>
                </div>
              </div>
              <button className="leave-btn" onClick={handleLeave} title="Leave room">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="chat-main">
            {/* Header */}
            <div className="chat-header">
              <div className="room-info">
                <div className="room-title"># {customRoom.trim() || room}</div>
                <div className="room-desc">
                  <div className="room-desc-dot"></div>
                  <span>{users.length} users active in room</span>
                </div>
              </div>
              <Link 
                href="/news"
                className="news-toggle-btn active"
                title="View tech news feed"
                style={{ textDecoration: "none" }}
              >
                📰 Tech News
              </Link>
            </div>

            {/* Main Area Content Panels */}
            {activeTab === "chat" ? (
              <>
                {/* Messages */}
                <div className="messages-container">
                  {messages.map((msg, idx) => {
                    if (msg.type === "system") {
                      return (
                        <div key={idx} className="message-system">
                          {msg.content}
                        </div>
                      );
                    }

                    if (msg.type === "poll") {
                      const isMe = msg.username === username;
                      const totalVotes = msg.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0;
                      const userVote = msg.voters?.[username];
                      return (
                        <div key={idx} className={`message-wrapper ${isMe ? "sent" : "received"}`}>
                          <div className="message-meta">
                            <span className="message-sender">{msg.username} 📊 Poll</span>
                            <span>{formatTime(msg.timestamp)}</span>
                          </div>
                          <div className="message-bubble" style={{ minWidth: "260px", padding: "16px", background: "rgba(168, 85, 247, 0.08)", border: "1px solid rgba(168, 85, 247, 0.2)" }}>
                            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#fff", lineHeight: "1.4" }}>
                              {msg.question}
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {msg.options?.map((opt, optIdx) => {
                                const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                const isSelected = userVote === opt.option;
                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => castVote(msg.pollId!, opt.option)}
                                    style={{
                                      position: "relative",
                                      width: "100%",
                                      padding: "10px 12px",
                                      background: isSelected ? "rgba(168, 85, 247, 0.15)" : "rgba(255,255,255,0.03)",
                                      border: isSelected ? "1px solid var(--primary)" : "1px solid rgba(255,255,255,0.06)",
                                      borderRadius: "8px",
                                      color: "#fff",
                                      fontSize: "13px",
                                      textAlign: "left",
                                      cursor: "pointer",
                                      overflow: "hidden",
                                      transition: "all 0.2s"
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        bottom: 0,
                                        width: `${percent}%`,
                                        background: isSelected ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.05)",
                                        zIndex: 0,
                                        transition: "width 0.4s ease"
                                      }}
                                    />
                                    <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between" }}>
                                      <span>{opt.option}</span>
                                      <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{percent}% ({opt.votes})</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "12px", textAlign: "right" }}>
                              Total Votes: {totalVotes}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (msg.type === "share_code") {
                      const isMe = msg.username === username;
                      return (
                        <div key={idx} className={`message-wrapper ${isMe ? "sent" : "received"}`}>
                          <div className="message-meta">
                            <span className="message-sender">{msg.username} 💻 Code Sandbox Share</span>
                            <span>{formatTime(msg.timestamp)}</span>
                          </div>
                          <div className="message-bubble" style={{ minWidth: "260px", padding: "16px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>Language: {msg.codeLanguage?.toUpperCase()}</span>
                              <button
                                type="button"
                                onClick={() => loadSharedCodeIntoSandbox(msg.codeSnippet!)}
                                style={{
                                  background: "rgba(59, 130, 246, 0.15)",
                                  border: "1px solid #3b82f6",
                                  borderRadius: "6px",
                                  color: "#60a5fa",
                                  fontSize: "11px",
                                  padding: "4px 8px",
                                  cursor: "pointer",
                                  fontWeight: 600
                                }}
                              >
                                Open in Sandbox
                              </button>
                            </div>
                            <pre style={{
                              margin: 0,
                              padding: "10px",
                              background: "#090d16",
                              borderRadius: "8px",
                              overflowX: "auto",
                              fontSize: "12px",
                              fontFamily: "monospace",
                              color: "#38bdf8",
                              maxHeight: "150px",
                              lineHeight: "1.5"
                            }}>
                              {msg.codeSnippet}
                            </pre>
                          </div>
                        </div>
                      );
                    }

                    const isMe = msg.username === username;
                    const isAI = msg.username?.startsWith("Nova AI");
                    return (
                      <div
                        key={idx}
                        className={`message-wrapper ${isMe ? "sent" : isAI ? "received ai" : "received"}`}
                      >
                        <div className="message-meta">
                          <span className="message-sender">
                            {isAI ? "Nova AI" : msg.username}
                            {isAI && <span className="ai-badge">Agent</span>}
                          </span>
                          <span>{formatTime(msg.timestamp)}</span>
                        </div>
                        <div className="message-bubble">
                          {msg.text && renderMessageText(msg.text)}
                          {msg.mediaUrl && (
                            <div className="message-media">
                              <img 
                                src={msg.mediaUrl} 
                                alt="AI Generated" 
                                className="generated-image"
                                loading="lazy"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Other users typing */}
                  {activeTyping && (
                    <div className="message-wrapper received" style={{ animation: "none" }}>
                      <div className="message-meta">
                        <span className="message-sender">{activeTyping}</span>
                      </div>
                      <div className="message-bubble" style={{ padding: "10px 14px" }}>
                        <div className="typing-indicator">
                          <span>typing</span>
                          <div className="typing-dots">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Footer */}
                <form onSubmit={handleSendMessage} className="chat-footer">
                  <div className="input-bar">
                    <button type="button" className="ai-trigger-btn" onClick={insertAITrigger}>
                      <span>✨ Ask AI</span>
                    </button>
                    <button type="button" className="ai-draw-btn" onClick={insertAIDrawTrigger}>
                      <span>🎨 Draw</span>
                    </button>
                    <button type="button" className="ai-draw-btn" onClick={() => setShowCreatePoll(true)} style={{ borderColor: "rgba(168, 85, 247, 0.4)" }}>
                      <span>📊 Poll</span>
                    </button>
                    <input
                      type="text"
                      className="chat-input"
                      placeholder={`Message #${customRoom.trim() || room}...`}
                      value={inputText}
                      onChange={handleInputChange}
                      maxLength={500}
                    />
                    <button type="submit" className="send-btn">
                      <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  </div>
                </form>
              </>
            ) : activeTab === "whiteboard" ? (
              <Whiteboard socket={socketRef.current} connected={socketConnected} username={username} />
            ) : activeTab === "sandbox" ? (
              <CodeSandbox
                html={htmlCode}
                css={cssCode}
                js={jsCode}
                onHtmlChange={setHtmlCode}
                onCssChange={setCssCode}
                onJsChange={setJsCode}
                onShare={shareCodeToChat}
              />
            ) : activeTab === "playground" ? (
              <Playground socket={socketRef.current} connected={socketConnected} username={username} />
            ) : (
              <SocialHub serverUrl={serverUrl} />
            )}
          </div>
        </div>
      )}

      {showCreatePoll && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: "450px", padding: "28px", border: "1px solid var(--panel-border)" }}>
            <h3 style={{ color: "#fff", margin: "0 0 16px 0", fontSize: "18px", fontWeight: 700 }}>Create Room Poll</h3>
            <form onSubmit={submitPoll}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" style={{ fontSize: "12px" }}>Poll Question</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="What is your favorite framework?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label" style={{ fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Options</span>
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                  >
                    + Add Option
                  </button>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[idx] = e.target.value;
                          setPollOptions(updated);
                        }}
                        required
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                          style={{
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "none",
                            borderRadius: "8px",
                            color: "#ef4444",
                            padding: "0 12px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePoll(false);
                    setPollQuestion("");
                    setPollOptions(["", ""]);
                  }}
                  className="leave-btn"
                  style={{ borderRadius: "10px", width: "fit-content", padding: "10px 18px", color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
                <button type="submit" className="back-to-chat-btn" style={{ background: "var(--primary-gradient)", border: "none", boxShadow: "0 4px 12px var(--primary-glow)", padding: "10px 18px" }}>
                  Launch Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
