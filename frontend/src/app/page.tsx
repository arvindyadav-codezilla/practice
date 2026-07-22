"use client";

import React, { useState, useEffect, useRef } from "react";

// Types
interface Exercise {
  name: string;
  duration: number;
  rest: number;
  description: string;
  muscleGroup: string;
  tip: string;
}

interface ChatMessage {
  sender: "user" | "trainer" | "system";
  text: string;
  timestamp: string;
}

export default function FlexAIPortal() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<"dashboard" | "workout" | "live" | "nutrition">("dashboard");
  const [selectedTrainer, setSelectedTrainer] = useState<"Max" | "Serena" | "Leo">("Max");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Workout Builder States
  const [workoutParams, setWorkoutParams] = useState({
    goal: "Build Muscle",
    level: "Intermediate",
    duration: 30,
    equipment: "Dumbbells",
  });
  const [workoutPlan, setWorkoutPlan] = useState<Exercise[] | null>(null);
  const [workoutGenerating, setWorkoutGenerating] = useState(false);

  // Live Workout Player States
  const [workoutActive, setWorkoutActive] = useState(false);
  const [workoutPaused, setWorkoutPaused] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0); // For circle percentage
  const [timerMode, setTimerMode] = useState<"exercise" | "rest" | "cooldown">("exercise");

  // Meal & Nutrition Planner States
  const [mealParams, setMealParams] = useState({
    goal: "Lose Weight",
    dietType: "Balanced",
    calories: 2000,
  });
  const [mealPlan, setMealPlan] = useState<any | null>(null);
  const [mealGenerating, setMealGenerating] = useState(false);

  // Chat & WebSocket States
  const [wsConnected, setWsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Timer Interval Reference
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Resolve dynamic URLs (works both locally and on Render/Vercel)
  const getApiUrl = (path: string) => {
    if (typeof window === "undefined") return "";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://127.0.0.1:8000${path}`;
    }
    return `https://practice-ihvr.onrender.com${path}`;
  };

  const getWsUrl = (path: string) => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `ws://127.0.0.1:8000${path}`;
    }
    return `wss://practice-ihvr.onrender.com${path}`;
  };

  // Helper: Text-to-speech
  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancel any active speech first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Customize speech properties based on trainer persona
    if (selectedTrainer === "Serena") {
      utterance.pitch = 1.1;
      utterance.rate = 0.85; // Calmer & slower
    } else if (selectedTrainer === "Leo") {
      utterance.pitch = 1.0;
      utterance.rate = 1.2;  // High speed HIIT style
    } else {
      utterance.pitch = 0.9;
      utterance.rate = 1.0;  // Motivating strength coach
    }

    window.speechSynthesis.speak(utterance);
  };

  // Connect to WebSocket Live Coach
  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    try {
      const url = getWsUrl("/ws/live-coach");
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setErrorMsg(null);
        // Start session on backend
        ws.send(JSON.stringify({
          type: "start",
          trainer: selectedTrainer
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "trainer_cue") {
          // Play the voice cue
          if (data.audioText) {
            speak(data.audioText);
          }
          setChatMessages((prev) => [
            ...prev,
            { sender: "trainer", text: data.cue, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        } else if (data.type === "message") {
          // Regular text message response from trainer
          if (data.audioText) {
            speak(data.audioText);
          }
          setChatMessages((prev) => [
            ...prev,
            { sender: "trainer", text: data.message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        } else if (data.type === "system") {
          setChatMessages((prev) => [
            ...prev,
            { sender: "system", text: data.message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    } catch (e) {
      console.error("WS connect error:", e);
    }
  };

  // Send message over WebSocket
  const sendChatMessage = (messageText: string) => {
    const text = messageText || inputText;
    if (!text.trim()) return;

    // Add to local chat logs immediately
    const userMsg: ChatMessage = {
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");

    if (socketRef.current && wsConnected) {
      socketRef.current.send(JSON.stringify({
        type: "message",
        trainer: selectedTrainer,
        message: text
      }));
    } else {
      // Offline fallback simulation
      setTimeout(() => {
        let reply = "I'm offline, but I still believe in you! Keep pushing and make every single rep count!";
        if (selectedTrainer === "Serena") {
          reply = "Even in silence, keep checking in with your breath. Find your center.";
        } else if (selectedTrainer === "Leo") {
          reply = "Come on! No excuses! Keep moving, keep sweating!";
        }
        setChatMessages((prev) => [
          ...prev,
          { sender: "trainer", text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
        speak(reply);
      }, 800);
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Trainer Intro Voice play
  const playTrainerIntro = (trainer: "Max" | "Serena" | "Leo") => {
    let introText = "";
    if (trainer === "Max") {
      introText = "Hey there! I am Max, your strength coach. Let's lift heavy, focus on your posture, and get stronger today. Keep pushing!";
    } else if (trainer === "Serena") {
      introText = "Welcome. I am Serena, your yoga guide. We will focus on smooth stretching, flow alignment, and peaceful breathing.";
    } else {
      introText = "Let's go! I am Leo, your HIIT specialist. Fast tempos, high speeds, and zero rest limits. Get ready to sweat!";
    }
    speak(introText);
  };

  // API Call: Generate Workout
  const fetchWorkout = async () => {
    setWorkoutGenerating(true);
    setErrorMsg(null);
    try {
      const response = await fetch(getApiUrl("/api/generate-workout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...workoutParams, trainer: selectedTrainer }),
      });
      if (!response.ok) throw new Error("Server returned an error");
      const data = await response.json();
      setWorkoutPlan(data.workout);
    } catch (err: any) {
      setErrorMsg("Failed to generate workout plan. Please verify backend connection.");
      console.error(err);
    } finally {
      setWorkoutGenerating(false);
    }
  };

  // API Call: Generate Meal Plan
  const fetchMealPlan = async () => {
    setMealGenerating(true);
    setErrorMsg(null);
    try {
      const response = await fetch(getApiUrl("/api/generate-meal-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mealParams),
      });
      if (!response.ok) throw new Error("Meal plan API failed");
      const data = await response.json();
      setMealPlan(data.mealPlan);
    } catch (err) {
      setErrorMsg("Failed to generate meal plan. Using local templates.");
    } finally {
      setMealGenerating(false);
    }
  };

  // Live Workout Player Logic
  const startWorkoutSession = () => {
    if (!workoutPlan || workoutPlan.length === 0) return;
    
    // Setup WS connection
    connectWebSocket();
    
    // Setup initial exercise parameters
    setWorkoutActive(true);
    setWorkoutPaused(false);
    setCurrentExerciseIndex(0);
    setTimerMode("exercise");
    
    const firstEx = workoutPlan[0];
    setTimeLeft(firstEx.duration);
    setTotalDuration(firstEx.duration);
    
    setActiveTab("live");
    
    // Build welcome chat message
    setChatMessages([
      { sender: "system", text: `Workout session started with ${selectedTrainer}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    // Speak welcome
    setTimeout(() => {
      speak(`Starting session. First exercise is ${firstEx.name}. Go for ${firstEx.duration} seconds.`);
    }, 500);
  };

  const pauseWorkout = () => {
    setWorkoutPaused(!workoutPaused);
  };

  const skipExercise = () => {
    if (!workoutPlan) return;
    if (timerMode === "exercise") {
      // Go to rest
      if (currentExerciseIndex < workoutPlan.length - 1) {
        setTimerMode("rest");
        setTimeLeft(workoutPlan[currentExerciseIndex].rest);
        setTotalDuration(workoutPlan[currentExerciseIndex].rest);
        speak("Take a breath. Rest time.");
      } else {
        // Workout complete
        endWorkoutSuccess();
      }
    } else {
      // Skip rest -> Go to next exercise
      const nextIndex = currentExerciseIndex + 1;
      setCurrentExerciseIndex(nextIndex);
      setTimerMode("exercise");
      setTimeLeft(workoutPlan[nextIndex].duration);
      setTotalDuration(workoutPlan[nextIndex].duration);
      
      const nextEx = workoutPlan[nextIndex];
      speak(`Next exercise: ${nextEx.name}. ${nextEx.duration} seconds. Let's do it!`);
      
      // Request cue update from socket
      if (socketRef.current && wsConnected) {
        socketRef.current.send(JSON.stringify({
          type: "cue_request",
          trainer: selectedTrainer,
          exercise: nextEx.name,
          tip: nextEx.tip
        }));
      }
    }
  };

  const endWorkoutSuccess = () => {
    setWorkoutActive(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    speak(`Congratulations! You have completed your workout with Coach ${selectedTrainer}. Fantastic job!`);
    setChatMessages((prev) => [
      ...prev,
      { sender: "system", text: "Workout Session completed successfully!", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    
    alert("Workout complete! Awesome work!");
  };

  // Timer Tick Mechanism
  useEffect(() => {
    if (workoutActive && !workoutPaused) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            
            // Trigger next state transition
            if (timerMode === "exercise") {
              if (workoutPlan && currentExerciseIndex < workoutPlan.length - 1) {
                // Shift to Rest mode
                setTimerMode("rest");
                const restTime = workoutPlan[currentExerciseIndex].rest;
                setTotalDuration(restTime);
                speak("Rest period. Walk it off.");
                return restTime;
              } else {
                // End of workout
                endWorkoutSuccess();
                return 0;
              }
            } else {
              // End of rest -> Shift to next exercise
              const nextIndex = currentExerciseIndex + 1;
              setCurrentExerciseIndex(nextIndex);
              setTimerMode("exercise");
              
              const nextEx = workoutPlan![nextIndex];
              setTotalDuration(nextEx.duration);
              speak(`Go! Next is ${nextEx.name}.`);
              
              if (socketRef.current && wsConnected) {
                socketRef.current.send(JSON.stringify({
                  type: "cue_request",
                  trainer: selectedTrainer,
                  exercise: nextEx.name,
                  tip: nextEx.tip
                }));
              }
              return nextEx.duration;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [workoutActive, workoutPaused, timerMode, currentExerciseIndex, workoutPlan, wsConnected]);

  // Circumference calculation for circular timer
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalDuration > 0 ? circumference - (timeLeft / totalDuration) * circumference : 0;

  return (
    <div className="app-container">
      {/* Header / Navbar */}
      <header className="navbar">
        <div className="brand">
          <span className="brand-icon">⚡</span>
          <span>FLEXAI // AI COACH</span>
        </div>
        
        <nav className="nav-tabs">
          <button 
            className={`nav-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "workout" ? "active" : ""}`}
            onClick={() => setActiveTab("workout")}
          >
            Workout Builder
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "live" ? "active" : ""}`}
            onClick={() => {
              if (!workoutActive && !workoutPlan) {
                alert("Please build and generate a workout plan first!");
              } else {
                setActiveTab("live");
              }
            }}
          >
            {workoutActive ? "🔴 Live Session" : "Live Player"}
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "nutrition" ? "active" : ""}`}
            onClick={() => setActiveTab("nutrition")}
          >
            Nutrition Planner
          </button>
        </nav>

        {/* Global Controls */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button 
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem", borderRadius: "8px" }}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Muted"}
          </button>
          <div className="stat-pill">
            <span>Streak</span>
            <span className="stat-val">🔥 5 Days</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {errorMsg && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid var(--error)",
            color: "#ffffff",
            padding: "12px 16px",
            borderRadius: "12px",
            fontSize: "0.9rem"
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "16px" }}>
              <h2 style={{ fontSize: "1.8rem" }}>Meet Your AI Training Staff</h2>
              <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
                Select your specialized coach. Their personality, instructions, and audio voices adjust dynamically to support your fitness level.
              </p>
            </div>

            {/* Trainer Grid */}
            <div className="grid-3">
              {/* Max */}
              <div 
                className={`trainer-card ${selectedTrainer === "Max" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Max")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-orange)" }}>
                  💪
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-orange)", color: "#000" }}>Strength</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Max <span style={{ fontSize: "0.9rem", color: "var(--text-dim)" }}>(Strength Coach)</span></div>
                  <div className="trainer-specialty">Hypertrophy, Muscle Gain & Powerlifting</div>
                  <p className="trainer-bio">
                    Dedicated strength specialist. Focuses on heavy weights, perfect range of motion, and high-energy encouragement.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.85rem" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Max"); }}
                  >
                    🗣️ Listen to Intro
                  </button>
                </div>
              </div>

              {/* Serena */}
              <div 
                className={`trainer-card ${selectedTrainer === "Serena" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Serena")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-violet)" }}>
                  🧘
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-violet)", color: "#fff" }}>Yoga/Core</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Serena <span style={{ fontSize: "0.9rem", color: "var(--text-dim)" }}>(Yoga Guru)</span></div>
                  <div className="trainer-specialty">Mobility, Flexibility & Core Rejuvenation</div>
                  <p className="trainer-bio">
                    Focuses on alignment, slow controlled flow, breathing cycles, and full recovery. Perfect for active restoration.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.85rem" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Serena"); }}
                  >
                    🗣️ Listen to Intro
                  </button>
                </div>
              </div>

              {/* Leo */}
              <div 
                className={`trainer-card ${selectedTrainer === "Leo" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Leo")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-pink)" }}>
                  ⚡
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-pink)", color: "#000" }}>HIIT</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Leo <span style={{ fontSize: "0.9rem", color: "var(--text-dim)" }}>(HIIT Coach)</span></div>
                  <div className="trainer-specialty">High Intensity, Cardio Conditioning & Fat Loss</div>
                  <p className="trainer-bio">
                    Fast pacing and extreme cardio endurance. Leo is relentless, keeps the timer ticking, and pushes your cardiovascular limit.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.85rem" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Leo"); }}
                  >
                    🗣️ Listen to Intro
                  </button>
                </div>
              </div>
            </div>

            {/* Summary / Stats Display */}
            <div className="grid-2" style={{ marginTop: "12px" }}>
              <div className="glass-panel" style={{ background: "rgba(255,255,255,0.01)" }}>
                <h3 style={{ marginBottom: "12px", fontSize: "1.1rem" }}>Today's Vital Metrics</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "12px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>HEART RATE</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--secondary)", marginTop: "4px" }}>78 BPM</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "12px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>EST. CALORIES</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>320 KCAL</div>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(255,255,255,0.01)" }}>
                <h3 style={{ marginBottom: "6px", fontSize: "1.1rem" }}>Selected Coach: Coach {selectedTrainer}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Your workout sessions and real-time support requests will be handled by Coach {selectedTrainer}. Switch your trainer anytime by selecting their card above.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Workout Builder */}
        {activeTab === "workout" && (
          <div className="grid-2">
            {/* Control Panel */}
            <div className="glass-panel" style={{ height: "fit-content" }}>
              <h2 style={{ marginBottom: "20px" }}>Configure Your AI Routine</h2>
              
              <div className="form-group">
                <label className="form-label">Active Goal</label>
                <select 
                  className="form-select"
                  value={workoutParams.goal}
                  onChange={(e) => setWorkoutParams({...workoutParams, goal: e.target.value})}
                >
                  <option value="Build Muscle">💪 Build Muscle & Strength</option>
                  <option value="Lose Weight">🔥 Lose Weight (HIIT Cardio)</option>
                  <option value="Flexibility">🧘 Yoga & Core Mobility</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Fitness Level</label>
                <select 
                  className="form-select"
                  value={workoutParams.level}
                  onChange={(e) => setWorkoutParams({...workoutParams, level: e.target.value})}
                >
                  <option value="Beginner">Beginner (Slow pace, gentle form)</option>
                  <option value="Intermediate">Intermediate (Standard sets)</option>
                  <option value="Advanced">Advanced (High reps, low rest)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Workout Duration (Minutes)</label>
                <select 
                  className="form-select"
                  value={workoutParams.duration}
                  onChange={(e) => setWorkoutParams({...workoutParams, duration: parseInt(e.target.value)})}
                >
                  <option value={15}>15 Minutes (Express Blast)</option>
                  <option value={30}>30 Minutes (Recommended)</option>
                  <option value={45}>45 Minutes (Full Session)</option>
                  <option value={60}>60 Minutes (Elite Endurance)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Available Equipment</label>
                <select 
                  className="form-select"
                  value={workoutParams.equipment}
                  onChange={(e) => setWorkoutParams({...workoutParams, equipment: e.target.value})}
                >
                  <option value="Bodyweight Only">🏃 Bodyweight Only (No Gear)</option>
                  <option value="Dumbbells">🏋️ Dumbbells</option>
                  <option value="Full Gym">🏬 Full Gym Infrastructure</option>
                </select>
              </div>

              <button 
                className="btn" 
                style={{ width: "100%", marginTop: "12px" }}
                disabled={workoutGenerating}
                onClick={fetchWorkout}
              >
                {workoutGenerating ? "🤖 Generating Plan..." : `Generate Plan with Coach ${selectedTrainer}`}
              </button>
            </div>

            {/* Workout Display */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2>Your Custom Workout Routine</h2>
                {workoutPlan && (
                  <button 
                    className="btn" 
                    style={{ background: "var(--success)", color: "#fff", padding: "8px 16px", fontSize: "0.85rem" }}
                    onClick={startWorkoutSession}
                  >
                    ⚡ Start Session
                  </button>
                )}
              </div>

              {!workoutPlan ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", color: "var(--text-muted)" }}>
                  <span style={{ fontSize: "3rem" }}>📋</span>
                  <p style={{ marginTop: "12px" }}>No active routine generated yet.</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Use the left panel to configure and build your custom AI workout plan.</p>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1, maxHeight: "450px" }}>
                  <div style={{ background: "rgba(163, 230, 53, 0.05)", border: "1px dashed var(--primary)", borderRadius: "12px", padding: "12px", marginBottom: "16px", fontSize: "0.85rem" }}>
                    <strong>ℹ️ Custom Coach Notice:</strong> Generated from {workoutGenerating ? "AI Engine" : "the backend system"}. Review the details below. Click "Start Session" to begin.
                  </div>
                  {workoutPlan.map((ex, index) => (
                    <div key={index} className="workout-item-card">
                      <div className="workout-item-left">
                        <span className="workout-item-title">{index + 1}. {ex.name}</span>
                        <span className="workout-item-meta">{ex.description}</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <span className="workout-item-tag">{ex.muscleGroup}</span>
                          <span className="workout-item-tag" style={{ background: "rgba(14, 165, 233, 0.08)", color: "var(--secondary)" }}>
                            ⏱️ {ex.duration}s Active
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--primary)", maxWidth: "160px", borderLeft: "1px solid var(--border-muted)", paddingLeft: "12px" }}>
                        <em>"{ex.tip}"</em>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Live Workout Player */}
        {activeTab === "live" && (
          <div className="grid-2">
            {/* Active player and controls */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {!workoutActive ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <span style={{ fontSize: "3rem" }}>⏱️</span>
                  <h3 style={{ marginTop: "16px", fontSize: "1.4rem" }}>No Session Running</h3>
                  <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
                    Configure a workout plan in the Builder tab and click "Start Session" to launch the voice coach.
                  </p>
                  <button 
                    className="btn" 
                    style={{ marginTop: "20px" }}
                    onClick={() => setActiveTab("workout")}
                  >
                    Go to Workout Builder
                  </button>
                </div>
              ) : (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <div>
                      <span className="trainer-badge" style={{ backgroundColor: selectedTrainer === "Max" ? "var(--accent-orange)" : selectedTrainer === "Serena" ? "var(--accent-violet)" : "var(--accent-pink)", color: "#000", position: "static" }}>
                        Coach {selectedTrainer}
                      </span>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      Exercise {currentExerciseIndex + 1} of {workoutPlan?.length || 0}
                    </div>
                  </div>

                  {/* Circular Timer */}
                  <div className="timer-container">
                    <svg className="timer-circle-svg">
                      <circle 
                        className="timer-circle-bg" 
                        cx="120" 
                        cy="120" 
                        r={radius} 
                      />
                      <circle 
                        className="timer-circle-progress" 
                        cx="120" 
                        cy="120" 
                        r={radius} 
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        style={{
                          stroke: timerMode === "rest" ? "var(--secondary)" : "var(--primary)"
                        }}
                      />
                    </svg>
                    <div className="timer-text-overlay">
                      <span className="timer-number">{timeLeft}</span>
                      <span className="timer-label">{timerMode === "rest" ? "Rest" : "Active"}</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ textAlign: "center", marginBottom: "28px" }}>
                    <h3 style={{ fontSize: "1.6rem", marginBottom: "8px" }}>
                      {timerMode === "rest" ? "Rest Period" : workoutPlan?.[currentExerciseIndex]?.name}
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: "400px", margin: "0 auto" }}>
                      {timerMode === "rest" 
                        ? `Prepare for next: ${workoutPlan?.[currentExerciseIndex + 1]?.name || "Cooldown"}`
                        : workoutPlan?.[currentExerciseIndex]?.description
                      }
                    </p>
                  </div>

                  {/* Player Buttons */}
                  <div style={{ display: "flex", gap: "16px" }}>
                    <button 
                      className={`btn ${workoutPaused ? "btn" : "btn-secondary"}`}
                      style={{ minWidth: "120px" }}
                      onClick={pauseWorkout}
                    >
                      {workoutPaused ? "▶️ Resume" : "⏸️ Pause"}
                    </button>
                    
                    <button 
                      className="btn" 
                      style={{ background: "var(--secondary)", color: "#fff", minWidth: "120px" }}
                      onClick={skipExercise}
                    >
                      ⏭️ Skip {timerMode === "exercise" ? "Rest" : "Next"}
                    </button>

                    <button 
                      className="btn" 
                      style={{ background: "var(--error)", color: "#fff" }}
                      onClick={() => {
                        if (confirm("Are you sure you want to quit the active session?")) {
                          setWorkoutActive(false);
                          speak("Workout session cancelled.");
                        }
                      }}
                    >
                      ⏹️ Stop
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Coach Voice Helper Chat */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3>Real-time Trainer Dialogue</h3>
                <span style={{ fontSize: "0.8rem", color: wsConnected ? "var(--success)" : "var(--text-dim)" }}>
                  ● {wsConnected ? "WebSocket Connected" : "Local Response Mode"}
                </span>
              </div>

              {/* Chat log */}
              <div className="coach-chat-box">
                <div className="coach-chat-messages">
                  {chatMessages.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "0.85rem", textAlign: "center" }}>
                      <span>💬 Dialogue history with Coach {selectedTrainer} will appear here.</span>
                      <span>Ask form tips or tell them if you are feeling tired.</span>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`chat-bubble ${msg.sender}`}
                      >
                        <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginBottom: "4px" }}>
                          {msg.sender === "user" ? "You" : msg.sender === "trainer" ? `Coach ${selectedTrainer}` : "System"} • {msg.timestamp}
                        </div>
                        {msg.text}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Prompts */}
                <div style={{ display: "flex", gap: "6px", padding: "8px", overflowX: "auto", borderTop: "1px solid var(--border-muted)", background: "rgba(0,0,0,0.15)" }}>
                  <button 
                    className="nav-tab-btn" 
                    style={{ fontSize: "0.75rem", padding: "4px 8px", background: "rgba(255,255,255,0.05)" }}
                    onClick={() => sendChatMessage("I'm feeling really tired, can I slow down?")}
                  >
                    😩 I'm tired
                  </button>
                  <button 
                    className="nav-tab-btn" 
                    style={{ fontSize: "0.75rem", padding: "4px 8px", background: "rgba(255,255,255,0.05)" }}
                    onClick={() => sendChatMessage("My knees are hurting during squats, any advice?")}
                  >
                    💥 Knee hurts
                  </button>
                  <button 
                    className="nav-tab-btn" 
                    style={{ fontSize: "0.75rem", padding: "4px 8px", background: "rgba(255,255,255,0.05)" }}
                    onClick={() => sendChatMessage("Give me a quick burst of extreme motivation!")}
                  >
                    🔥 Motivate me!
                  </button>
                  <button 
                    className="nav-tab-btn" 
                    style={{ fontSize: "0.75rem", padding: "4px 8px", background: "rgba(255,255,255,0.05)" }}
                    onClick={() => sendChatMessage("Explain the correct form of the current exercise.")}
                  >
                    ❓ Check Form
                  </button>
                </div>

                {/* Input area */}
                <div className="coach-chat-input-area">
                  <input 
                    type="text" 
                    className="coach-chat-input"
                    placeholder={`Ask Coach ${selectedTrainer} a question...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChatMessage("");
                    }}
                  />
                  <button 
                    className="btn"
                    style={{ borderRadius: "10px", padding: "8px 16px" }}
                    onClick={() => sendChatMessage("")}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Nutrition Planner */}
        {activeTab === "nutrition" && (
          <div className="grid-2">
            {/* Inputs */}
            <div className="glass-panel" style={{ height: "fit-content" }}>
              <h2 style={{ marginBottom: "20px" }}>AI Meal Plan Settings</h2>

              <div className="form-group">
                <label className="form-label">Primary Goal</label>
                <select 
                  className="form-select"
                  value={mealParams.goal}
                  onChange={(e) => setMealParams({...mealParams, goal: e.target.value})}
                >
                  <option value="Lose Weight">📉 Weight Loss / Shred</option>
                  <option value="Build Muscle">📈 Lean Bulk / Muscle Gain</option>
                  <option value="Maintain Fitness">⚖️ Maintenance / Athletic Performance</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Dietary Preference</label>
                <select 
                  className="form-select"
                  value={mealParams.dietType}
                  onChange={(e) => setMealParams({...mealParams, dietType: e.target.value})}
                >
                  <option value="Balanced">Balanced (Standard clean eating)</option>
                  <option value="High Protein">High Protein / Low Carb</option>
                  <option value="Vegan">Vegan (100% plant-based)</option>
                  <option value="Vegetarian">Vegetarian (No meat, eggs/dairy allowed)</option>
                  <option value="Keto">Ketogenic (Very low carb, high fat)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Daily Calories Limit: {mealParams.calories} kcal</label>
                <input 
                  type="range" 
                  min="1200" 
                  max="4000" 
                  step="100"
                  style={{
                    accentColor: "var(--primary)",
                    margin: "8px 0"
                  }}
                  value={mealParams.calories}
                  onChange={(e) => setMealParams({...mealParams, calories: parseInt(e.target.value)})}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  <span>1200 kcal</span>
                  <span>4000 kcal</span>
                </div>
              </div>

              <button 
                className="btn" 
                style={{ width: "100%", marginTop: "12px" }}
                disabled={mealGenerating}
                onClick={fetchMealPlan}
              >
                {mealGenerating ? "🍎 Designing meal plan..." : "Generate AI Meal Plan"}
              </button>
            </div>

            {/* Display */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              <h2>Your Custom Nutrition Guide</h2>

              {!mealPlan ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "320px", color: "var(--text-muted)" }}>
                  <span style={{ fontSize: "3rem" }}>🥗</span>
                  <p style={{ marginTop: "12px" }}>No meal plan generated yet.</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Configure your goals and click generate to create a custom diet profile.</p>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1, maxHeight: "450px", marginTop: "16px" }}>
                  
                  {/* Macros Badge */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "20px", background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "12px", border: "1px solid var(--border-muted)" }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>CARBS</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--secondary)" }}>{mealPlan.Macros?.Carbs || "N/A"}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", borderLeft: "1px solid var(--border-muted)", borderRight: "1px solid var(--border-muted)" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>PROTEIN</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--primary)" }}>{mealPlan.Macros?.Protein || "N/A"}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>FAT</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-orange)" }}>{mealPlan.Macros?.Fat || "N/A"}</div>
                    </div>
                  </div>

                  {/* Meals */}
                  <div className="meal-card">
                    <div className="meal-time">Breakfast</div>
                    <div className="meal-name">{mealPlan.Breakfast}</div>
                  </div>

                  <div className="meal-card" style={{ borderLeftColor: "var(--secondary)" }}>
                    <div className="meal-time" style={{ color: "var(--secondary)" }}>Lunch</div>
                    <div className="meal-name">{mealPlan.Lunch}</div>
                  </div>

                  <div className="meal-card" style={{ borderLeftColor: "var(--accent-pink)" }}>
                    <div className="meal-time" style={{ color: "var(--accent-pink)" }}>Snack</div>
                    <div className="meal-name">{mealPlan.Snack}</div>
                  </div>

                  <div className="meal-card" style={{ borderLeftColor: "var(--accent-violet)" }}>
                    <div className="meal-time" style={{ color: "var(--accent-violet)" }}>Dinner</div>
                    <div className="meal-name">{mealPlan.Dinner}</div>
                  </div>

                  {/* Shopping List */}
                  {mealPlan.Shopping && mealPlan.Shopping.length > 0 && (
                    <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-muted)", paddingTop: "16px" }}>
                      <h4 style={{ marginBottom: "12px", fontSize: "1rem" }}>🛒 Smart Shopping List Checklist</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        {mealPlan.Shopping.map((item: string, idx: number) => (
                          <label key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.85rem", cursor: "pointer", color: "var(--text-muted)" }}>
                            <input type="checkbox" style={{ accentColor: "var(--primary)" }} />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "20px",
        fontSize: "0.75rem",
        color: "var(--text-dim)",
        borderTop: "1px solid var(--border-muted)",
        background: "rgba(9, 9, 11, 0.4)",
        marginTop: "auto"
      }}>
        FlexAI Portal • Powered by FastAPI & Gemini Flash • Real-time Coach Audio Engine
      </footer>
    </div>
  );
}
