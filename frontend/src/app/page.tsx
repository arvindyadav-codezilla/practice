"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your_supabase")
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
  // Authentication States
  const [user, setUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // WhatsApp States
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [callmebotKey, setCallmebotKey] = useState("");
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<"dashboard" | "workout" | "live" | "nutrition">("dashboard");
  const [selectedTrainer, setSelectedTrainer] = useState<"Max" | "Serena" | "Leo">("Max");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User Stats (Loaded from DB or Mocked)
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [streakCount, setStreakCount] = useState(5);

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
  const [totalDuration, setTotalDuration] = useState(0); 
  const [timerMode, setTimerMode] = useState<"exercise" | "rest" | "cooldown">("exercise");
  const [simulatedHeartRate, setSimulatedHeartRate] = useState(72);

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

  // Helper: Resolve URLs
  const getApiUrl = (path: string) => {
    if (typeof window === "undefined") return "";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${hostname}:8000${path}`;
    }
    const envUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL;
    if (envUrl) {
      const httpUrl = envUrl.replace("wss://", "https://").replace("ws://", "http://").replace("/ws", "");
      return `${httpUrl}${path}`;
    }
    return `https://synapse-chat-backend.onrender.com${path}`;
  };

  const getWsUrl = (path: string) => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000${path}`;
    }
    const envUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL;
    if (envUrl) {
      const wsBase = envUrl.replace("/ws", "");
      return `${wsBase}${path}`;
    }
    return `wss://synapse-chat-backend.onrender.com${path}`;
  };

  // Listen to Auth State Changes
  useEffect(() => {
    if (!supabase) return;

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
        fetchUserStats(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
        fetchUserStats(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Stats from Backend (which pulls from Supabase)
  const fetchUserStats = async (userId: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/user-stats/${userId}`));
      if (res.ok) {
        const data = await res.json();
        setTotalWorkouts(data.totalWorkouts || 0);
        setCaloriesBurned(data.totalCalories || 0);
        setStreakCount(data.streak || 0);
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  // Fetch User Profile Settings from Backend
  const fetchUserProfile = async (userId: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/profile/${userId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.profile) {
          const prof = data.profile;
          setUsername(prof.username || "");
          setWhatsappNumber(prof.whatsapp_number || "");
          setCallmebotKey(prof.callmebot_key || "");
          setWorkoutParams({
            goal: prof.goal || "Build Muscle",
            level: prof.level || "Intermediate",
            duration: prof.duration || 30,
            equipment: prof.equipment || "Dumbbells",
          });
        }
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    }
  };

  // Update Profile Settings on Supabase
  const saveUserProfile = async (updatedParams: typeof workoutParams) => {
    if (!user) return;
    try {
      const res = await fetch(getApiUrl("/api/profile/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          username: username || user.email?.split("@")[0] || "User",
          goal: updatedParams.goal,
          level: updatedParams.level,
          duration: updatedParams.duration,
          equipment: updatedParams.equipment,
          whatsappNumber: whatsappNumber,
          callmebotKey: callmebotKey
        }),
      });
      if (res.ok) {
        alert("Settings saved successfully!");
      }
    } catch (e) {
      console.error("Error saving profile:", e);
      alert("Failed to save settings.");
    }
  };

  // Dispatch Daily Workout/Diet Summary to WhatsApp
  const sendWhatsAppBrief = async () => {
    if (!user) return;
    if (!whatsappNumber || !callmebotKey) {
      alert("Please configure your WhatsApp Phone Number and CallMeBot Key in the Profile settings card first!");
      return;
    }
    setSendingWhatsApp(true);
    try {
      const res = await fetch(getApiUrl("/api/send-whatsapp-brief"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          workout: workoutPlan || undefined,
          mealPlan: mealPlan || undefined
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("📲 Daily Briefing sent to your WhatsApp successfully!");
      } else {
        alert(`❌ Failed to send brief: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error sending brief. Please verify your backend server.");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Login Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supabase credentials not configured in env yet. Using offline mode.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
        fetchUserProfile(data.user.id);
        fetchUserStats(data.user.id);
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in");
    } finally {
      setAuthLoading(false);
    }
  };

  // Register Handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supabase credentials not configured. Using offline mode.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            display_name: username || authEmail.split("@")[0],
          }
        }
      });
      if (error) throw error;
      alert("Registration successful! Check your email for verification link.");
      setAuthMode("signin");
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign up");
    } finally {
      setAuthLoading(false);
    }
  };

  // Offline Bypass
  const handleSkipAuth = () => {
    setUser({
      id: "offline-user-uid-placeholder",
      email: "offline-gymmer@flexai.io",
      offline: true
    });
    setUsername("Guest Athlete");
    setTotalWorkouts(3);
    setCaloriesBurned(340);
    setStreakCount(5);
  };

  // Logout Handler
  const handleSignOut = async () => {
    if (supabase && !user?.offline) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setAuthEmail("");
    setAuthPassword("");
    setWorkoutPlan(null);
    setWorkoutActive(false);
  };

  // Helper: Text-to-speech
  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedTrainer === "Serena") {
      utterance.pitch = 1.15;
      utterance.rate = 0.8; 
    } else if (selectedTrainer === "Leo") {
      utterance.pitch = 1.05;
      utterance.rate = 1.25; 
    } else {
      utterance.pitch = 0.9;
      utterance.rate = 1.0; 
    }

    window.speechSynthesis.speak(utterance);
  };

  // Connect WebSocket
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
        ws.send(JSON.stringify({
          type: "start",
          trainer: selectedTrainer
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "trainer_cue") {
          if (data.audioText) speak(data.audioText);
          setChatMessages((prev) => [
            ...prev,
            { sender: "trainer", text: data.cue, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        } else if (data.type === "message") {
          if (data.audioText) speak(data.audioText);
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

      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Send message
  const sendChatMessage = (messageText: string) => {
    const text = messageText || inputText;
    if (!text.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setInputText("");

    if (socketRef.current && wsConnected) {
      socketRef.current.send(JSON.stringify({
        type: "message",
        trainer: selectedTrainer,
        message: text
      }));
    } else {
      setTimeout(() => {
        let reply = "Keep pushing! Make every rep count.";
        if (selectedTrainer === "Serena") {
          reply = "Inhale peace, exhale tension. Let your alignment guide you.";
        } else if (selectedTrainer === "Leo") {
          reply = "Speed it up! Sweat is just fat crying! Let's go!";
        }
        setChatMessages((prev) => [
          ...prev,
          { sender: "trainer", text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
        speak(reply);
      }, 700);
    }
  };

  // Simulated Heart Rate Tracker
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (workoutActive && !workoutPaused) {
      interval = setInterval(() => {
        const base = timerMode === "exercise" ? 142 : 108;
        const fluctuation = Math.floor(Math.random() * 12) - 6; 
        setSimulatedHeartRate(base + fluctuation);
      }, 2000);
    } else {
      setSimulatedHeartRate(74);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workoutActive, workoutPaused, timerMode]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

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
      
      // Save profile variables to Database
      saveUserProfile(workoutParams);
    } catch (err: any) {
      setErrorMsg("Failed to generate workout plan. Check backend server.");
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
      setErrorMsg("Failed to generate meal plan. Using local presets.");
    } finally {
      setMealGenerating(false);
    }
  };

  // Live Workout Player control
  const startWorkoutSession = () => {
    if (!workoutPlan || workoutPlan.length === 0) return;
    
    connectWebSocket();
    setWorkoutActive(true);
    setWorkoutPaused(false);
    setCurrentExerciseIndex(0);
    setTimerMode("exercise");
    
    const firstEx = workoutPlan[0];
    setTimeLeft(firstEx.duration);
    setTotalDuration(firstEx.duration);
    
    setActiveTab("live");
    setChatMessages([
      { sender: "system", text: `Active session started with Coach ${selectedTrainer}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    setTimeout(() => {
      speak(`Starting session. First is ${firstEx.name}. Ready, set, go!`);
    }, 400);
  };

  const pauseWorkout = () => {
    setWorkoutPaused(!workoutPaused);
  };

  const skipExercise = () => {
    if (!workoutPlan) return;
    if (timerMode === "exercise") {
      if (currentExerciseIndex < workoutPlan.length - 1) {
        setTimerMode("rest");
        setTimeLeft(workoutPlan[currentExerciseIndex].rest);
        setTotalDuration(workoutPlan[currentExerciseIndex].rest);
        speak("Rest period. Recover now.");
      } else {
        endWorkoutSuccess();
      }
    } else {
      const nextIndex = currentExerciseIndex + 1;
      setCurrentExerciseIndex(nextIndex);
      setTimerMode("exercise");
      setTimeLeft(workoutPlan[nextIndex].duration);
      setTotalDuration(workoutPlan[nextIndex].duration);
      
      const nextEx = workoutPlan[nextIndex];
      speak(`Next up: ${nextEx.name}. Go!`);
      
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

  const endWorkoutSuccess = async () => {
    setWorkoutActive(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    speak(`Workout completed! Spectacular effort with Coach ${selectedTrainer}. Maintain the consistency!`);
    setChatMessages((prev) => [
      ...prev,
      { sender: "system", text: "Workout completed!", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    // Save logs to Supabase DB via FastAPI
    if (user) {
      try {
        const estCalories = workoutPlan ? workoutPlan.length * 75 : 300;
        const totalSecs = workoutPlan ? workoutPlan.reduce((acc, curr) => acc + curr.duration + curr.rest, 0) : 1800;
        
        const res = await fetch(getApiUrl("/api/save-workout-log"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            trainer: selectedTrainer,
            duration: Math.ceil(totalSecs / 60),
            caloriesBurned: estCalories,
            workoutPlan: workoutPlan
          })
        });
        if (res.ok) {
          fetchUserStats(user.id);
        }
      } catch (e) {
        console.error("Error saving log:", e);
      }
    }
    
    alert("Workout finished! Awesome job!");
  };

  // Timer Tick
  useEffect(() => {
    if (workoutActive && !workoutPaused) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            
            if (timerMode === "exercise") {
              if (workoutPlan && currentExerciseIndex < workoutPlan.length - 1) {
                setTimerMode("rest");
                const restTime = workoutPlan[currentExerciseIndex].rest;
                setTotalDuration(restTime);
                speak("Time for a quick break.");
                return restTime;
              } else {
                endWorkoutSuccess();
                return 0;
              }
            } else {
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

  // Radius for SVG timer circle
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalDuration > 0 ? circumference - (timeLeft / totalDuration) * circumference : 0;

  // Render Login Card if User is not logged in
  if (!user) {
    return (
      <div className="auth-card-wrapper">
        <div className="glass-panel auth-card">
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "3rem" }}>⚡</span>
            <h1 style={{ fontSize: "1.8rem", marginTop: "8px" }}>FLEXAI // AI PORTAL</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
              Join to customize workouts and sync fitness metrics in real time.
            </p>
          </div>

          {authError && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--error)", color: "#ff8888", padding: "10px 14px", borderRadius: "10px", fontSize: "0.8rem", marginBottom: "16px" }}>
              ❌ {authError}
            </div>
          )}

          {/* Form Auth Tabs */}
          <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "4px", borderRadius: "10px", marginBottom: "20px", border: "1px solid var(--border-muted)" }}>
            <button 
              className="nav-tab-btn" 
              style={{ flex: 1, padding: "6px", background: authMode === "signin" ? "var(--primary)" : "transparent", color: authMode === "signin" ? "#000" : "var(--text-muted)" }}
              onClick={() => setAuthMode("signin")}
            >
              Sign In
            </button>
            <button 
              className="nav-tab-btn" 
              style={{ flex: 1, padding: "6px", background: authMode === "signup" ? "var(--primary)" : "transparent", color: authMode === "signup" ? "#000" : "var(--text-muted)" }}
              onClick={() => setAuthMode("signup")}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={authMode === "signin" ? handleSignIn : handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {authMode === "signup" && (
              <div className="form-group">
                <label className="form-label">Athlete Nickname</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. FitChamp"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="athlete@domain.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Secure Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
              />
            </div>

            <button className="btn" type="submit" style={{ width: "100%", marginTop: "6px" }} disabled={authLoading}>
              {authLoading ? "Synchronizing..." : authMode === "signin" ? "Access Dashboard" : "Create Athlete Account"}
            </button>
          </form>

          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>— OR —</span>
            <button 
              className="btn btn-secondary" 
              style={{ width: "100%", borderRadius: "12px", fontSize: "0.85rem" }}
              onClick={handleSkipAuth}
            >
              🏃 Skip (Use Offline Demo Mode)
            </button>
            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textAlign: "center" }}>
              {!supabase && "⚠️ Database not configured in local environment. Offline mode available."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container theme-${selectedTrainer}`}>
      {/* Desktop Header */}
      <header className="navbar">
        <div className="brand" onClick={() => setActiveTab("dashboard")} style={{ cursor: "pointer" }}>
          <span className="brand-icon">⚡</span>
          <span>FLEXAI // {username || "ATHLETE"}</span>
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
            {workoutActive ? "🔴 Live Player" : "Live Player"}
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === "nutrition" ? "active" : ""}`}
            onClick={() => setActiveTab("nutrition")}
          >
            Nutrition Planner
          </button>
        </nav>

        {/* Global toggles / stats */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button 
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "8px" }}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Muted"}
          </button>
          <button 
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "8px", border: "1px dashed var(--error)", color: "var(--error)" }}
            onClick={handleSignOut}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Panel */}
      <main className="main-content">
        {errorMsg && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--error)",
            color: "#ff8888",
            padding: "12px 16px",
            borderRadius: "14px",
            fontSize: "0.85rem"
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="glass-panel glow-primary" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ fontSize: "1.6rem" }}>Select Your AI Gym Coach</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                  Select a trainer card below. The interface theme, fonts, prompts, and spoken speech synthesis change immediately.
                </p>
              </div>
              {user?.offline && (
                <div style={{ background: "rgba(249, 115, 22, 0.1)", border: "1px solid var(--accent-orange)", padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", color: "var(--accent-orange)", fontWeight: 700 }}>
                  🚨 Running in Offline Demo Mode
                </div>
              )}
            </div>

            {/* Trainer Cards */}
            <div className="grid-3">
              {/* Max */}
              <div 
                className={`trainer-card card-Max ${selectedTrainer === "Max" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Max")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-orange)" }}>
                  💪
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-orange)", color: "#000" }}>Strength</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Max</div>
                  <div className="trainer-specialty">Strength & Muscle Overload</div>
                  <p className="trainer-bio">
                    Dedicated strength specialist. Focuses on heavy weights, perfect range of motion, and high-energy encouragement.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.8rem", borderRadius: "10px", padding: "8px" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Max"); }}
                  >
                    🗣️ Hear Intro
                  </button>
                </div>
              </div>

              {/* Serena */}
              <div 
                className={`trainer-card card-Serena ${selectedTrainer === "Serena" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Serena")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-violet)" }}>
                  🧘
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-violet)", color: "#000" }}>Yoga/Core</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Serena</div>
                  <div className="trainer-specialty">Yoga Flow & Mobility</div>
                  <p className="trainer-bio">
                    Focuses on alignment, slow controlled flow, breathing cycles, and full recovery. Perfect for active restoration.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.8rem", borderRadius: "10px", padding: "8px" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Serena"); }}
                  >
                    🗣️ Hear Intro
                  </button>
                </div>
              </div>

              {/* Leo */}
              <div 
                className={`trainer-card card-Leo ${selectedTrainer === "Leo" ? "selected" : ""}`}
                onClick={() => setSelectedTrainer("Leo")}
              >
                <div className="trainer-img-placeholder" style={{ color: "var(--accent-pink)" }}>
                  ⚡
                  <span className="trainer-badge" style={{ backgroundColor: "var(--accent-pink)", color: "#000" }}>HIIT</span>
                </div>
                <div className="trainer-info">
                  <div className="trainer-name">Leo</div>
                  <div className="trainer-specialty">HIIT & Cardiovascular Burn</div>
                  <p className="trainer-bio">
                    Fast pacing and extreme cardio endurance. Leo is relentless, keeps the timer ticking, and pushes your cardiovascular limit.
                  </p>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", fontSize: "0.8rem", borderRadius: "10px", padding: "8px" }}
                    onClick={(e) => { e.stopPropagation(); playTrainerIntro("Leo"); }}
                  >
                    🗣️ Hear Intro
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid-2">
              <div className="glass-panel" style={{ background: "rgba(0,0,0,0.15)" }}>
                <h3 style={{ fontSize: "1.5rem", marginBottom: "16px" }}>Persistent Metrics (Supabase DB)</h3>
                <div className="stats-grid">
                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "12px", border: "1px solid var(--border-muted)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>COMPLETED</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--secondary)", marginTop: "2px" }}>{totalWorkouts} Sessions</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "12px", border: "1px solid var(--border-muted)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>BURNED</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>{caloriesBurned} KCal</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "12px", border: "1px solid var(--border-muted)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>STREAK</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--accent-orange)", marginTop: "2px" }}>🔥 {streakCount} Days</div>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ background: "rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "4px" }}>👤 Profile & WhatsApp Briefings</h3>
                <div className="form-group" style={{ marginBottom: "0px" }}>
                  <label className="form-label" style={{ fontSize: "0.7rem" }}>Athlete Nickname</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ padding: "8px 12px", fontSize: "0.8rem", width: "100%" }}
                    placeholder="Athlete Name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "0px" }}>
                  <label className="form-label" style={{ fontSize: "0.7rem" }}>WhatsApp Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ padding: "8px 12px", fontSize: "0.8rem", width: "100%" }}
                    placeholder="e.g. +919876543210"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "0px" }}>
                  <label className="form-label" style={{ fontSize: "0.7rem" }}>CallMeBot API Key</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    style={{ padding: "8px 12px", fontSize: "0.8rem", width: "100%" }}
                    placeholder="Key"
                    value={callmebotKey}
                    onChange={(e) => setCallmebotKey(e.target.value)}
                  />
                </div>
                <button 
                  className="btn" 
                  style={{ padding: "8px 14px", fontSize: "0.8rem", borderRadius: "10px", marginTop: "4px", width: "100%" }}
                  onClick={() => saveUserProfile(workoutParams)}
                >
                  Save Profile Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Workout Builder */}
        {activeTab === "workout" && (
          <div className="grid-2">
            {/* Left Parameters */}
            <div className="glass-panel glow-primary" style={{ height: "fit-content" }}>
              <h2 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Configure Your AI Routine</h2>
              
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
                  <option value="Beginner">Beginner (Perfecting form)</option>
                  <option value="Intermediate">Intermediate (Standard splits)</option>
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
                  <option value={15}>15 Mins (Express Blast)</option>
                  <option value={30}>30 Mins (Recommended)</option>
                  <option value={45}>45 Mins (Full Session)</option>
                  <option value={60}>60 Mins (Elite Conditioning)</option>
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
                style={{ width: "100%", marginTop: "8px" }}
                disabled={workoutGenerating}
                onClick={fetchWorkout}
              >
                {workoutGenerating ? "🤖 Generating Plan..." : `Generate Plan with Coach ${selectedTrainer}`}
              </button>
            </div>

            {/* Right Results list */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", minHeight: "350px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <h2 style={{ fontSize: "1.4rem" }}>Your Exercises</h2>
                {workoutPlan && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: "8px 16px", fontSize: "0.8rem", borderRadius: "10px" }}
                      onClick={sendWhatsAppBrief}
                      disabled={sendingWhatsApp}
                    >
                      {sendingWhatsApp ? "📲 Sending..." : "📲 Send to WhatsApp"}
                    </button>
                    <button 
                      className="btn" 
                      style={{ background: "var(--primary)", color: "#000", padding: "8px 16px", fontSize: "0.8rem", borderRadius: "10px" }}
                      onClick={startWorkoutSession}
                    >
                      ⚡ Start Session
                    </button>
                  </div>
                )}
              </div>

              {!workoutPlan ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", textAlign: "center" }}>
                  <span style={{ fontSize: "2.5rem" }}>📋</span>
                  <p style={{ marginTop: "12px", fontSize: "0.9rem" }}>No plan active.</p>
                  <p style={{ fontSize: "0.75rem" }}>Configure settings on the left and click Generate.</p>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1, maxHeight: "420px" }}>
                  {workoutPlan.map((ex, index) => (
                    <div key={index} className="workout-item-card">
                      <div className="workout-item-left">
                        <span className="workout-item-title">{index + 1}. {ex.name}</span>
                        <span className="workout-item-meta">{ex.description}</span>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <span className="workout-item-tag">{ex.muscleGroup}</span>
                          <span className="workout-item-tag" style={{ border: "1px solid var(--secondary)", color: "var(--secondary)" }}>
                            ⏱️ {ex.duration}s Active
                          </span>
                        </div>
                      </div>
                      <div className="workout-item-tip">
                        <em>"{ex.tip}"</em>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Live Player */}
        {activeTab === "live" && (
          <div className="grid-2">
            {/* Active player controller */}
            <div className="glass-panel glow-primary" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "350px" }}>
              {!workoutActive ? (
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "2.5rem" }}>⏱️</span>
                  <h3 style={{ marginTop: "12px", fontSize: "1.2rem" }}>No Active Session</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "4px" }}>
                    Build a workout plan first, then click "Start Session" to initiate audio triggers.
                  </p>
                  <button 
                    className="btn" 
                    style={{ marginTop: "16px" }}
                    onClick={() => setActiveTab("workout")}
                  >
                    Configure Workout
                  </button>
                </div>
              ) : (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span className="trainer-badge" style={{ backgroundColor: "var(--primary)", color: "#000", position: "static" }}>
                        Coach {selectedTrainer}
                      </span>
                      <div className="heart-beat-container">
                        <span className="heart-icon">❤️</span>
                        <span>Pulse: <strong>{simulatedHeartRate}</strong></span>
                      </div>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 700 }}>
                      Set {currentExerciseIndex + 1} of {workoutPlan?.length || 0}
                    </div>
                  </div>

                  {/* Circular visual timer */}
                  <div className="timer-container">
                    <svg className="timer-circle-svg" viewBox="0 0 200 200">
                      <circle 
                        className="timer-circle-bg" 
                        cx="100" 
                        cy="100" 
                        r={radius} 
                      />
                      <circle 
                        className="timer-circle-progress" 
                        cx="100" 
                        cy="100" 
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

                  {/* Descriptions */}
                  <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "1.35rem", marginBottom: "6px" }}>
                      {timerMode === "rest" ? "Take a Breath" : workoutPlan?.[currentExerciseIndex]?.name}
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "350px", margin: "0 auto", lineHeight: "1.4" }}>
                      {timerMode === "rest" 
                        ? `Get ready for: ${workoutPlan?.[currentExerciseIndex + 1]?.name || "Cooldown"}`
                        : workoutPlan?.[currentExerciseIndex]?.description
                      }
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                    <button 
                      className={`btn ${workoutPaused ? "btn" : "btn-secondary"}`}
                      style={{ minWidth: "100px", padding: "10px 16px", fontSize: "0.85rem" }}
                      onClick={pauseWorkout}
                    >
                      {workoutPaused ? "▶️ Resume" : "⏸️ Pause"}
                    </button>
                    
                    <button 
                      className="btn" 
                      style={{ background: "var(--secondary)", color: "#fff", minWidth: "100px", padding: "10px 16px", fontSize: "0.85rem" }}
                      onClick={skipExercise}
                    >
                      ⏭️ Skip
                    </button>

                    <button 
                      className="btn" 
                      style={{ background: "var(--error)", color: "#fff", padding: "10px 16px", fontSize: "0.85rem" }}
                      onClick={() => {
                        if (confirm("Stop the active session?")) {
                          setWorkoutActive(false);
                          speak("Workout session cancelled.");
                        }
                      }}
                    >
                      ⏹️ End
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right dynamic voice dialogue chat */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", height: "fit-content" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "6px" }}>
                <h3 style={{ fontSize: "1.1rem" }}>Trainer Response Node</h3>
                <span style={{ fontSize: "0.75rem", color: wsConnected ? "var(--success)" : "var(--text-dim)", fontWeight: 700 }}>
                  ● {wsConnected ? "WebSocket Online" : "Offline Backup Mode"}
                </span>
              </div>

              {/* Chat messages wrapper */}
              <div className="coach-chat-box">
                <div className="coach-chat-messages">
                  {chatMessages.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "0.8rem", textAlign: "center" }}>
                      <span>💬 Real-time dialogues with Coach {selectedTrainer} appear here.</span>
                      <span>Ask custom tips or select quick triggers below.</span>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`chat-bubble ${msg.sender}`}
                      >
                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>
                          {msg.sender === "user" ? "You" : msg.sender === "trainer" ? `Coach ${selectedTrainer}` : "System"} • {msg.timestamp}
                        </div>
                        {msg.text}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Mobile-friendly quick prompts */}
                <div style={{ display: "flex", gap: "6px", padding: "6px", overflowX: "auto", borderTop: "1px solid var(--border-muted)", background: "rgba(0,0,0,0.2)" }}>
                  <button 
                    className="nav-tab-btn" 
                    style={{ fontSize: "0.7rem", padding: "4px 8px", background: "rgba(255,255,255,0.03)" }}
                    onClick={() => sendChatMessage("I'm feeling really tired, can I slow down?")}
                  >
                    😩 I'm tired
                  </button>
                  <button 
                    className="nav-tab-btn" 
                    style={{ fontSize: "0.7rem", padding: "4px 8px", background: "rgba(255,255,255,0.03)" }}
                    onClick={() => sendChatMessage("My knees are hurting during squats, any advice?")}
                  >
                    💥 Knee hurts
                  </button>
                  <button 
                    className="nav-tab-btn" 
                    style={{ fontSize: "0.7rem", padding: "4px 8px", background: "rgba(255,255,255,0.03)" }}
                    onClick={() => sendChatMessage("Give me a quick burst of extreme motivation!")}
                  >
                    🔥 Motivate me!
                  </button>
                </div>

                {/* Input area */}
                <div className="coach-chat-input-area">
                  <input 
                    type="text" 
                    className="coach-chat-input"
                    placeholder={`Ask Coach ${selectedTrainer}...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChatMessage("");
                    }}
                  />
                  <button 
                    className="btn"
                    style={{ borderRadius: "10px", padding: "8px 14px", fontSize: "0.8rem" }}
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
            {/* Input Configurator */}
            <div className="glass-panel glow-primary" style={{ height: "fit-content" }}>
              <h2 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>AI Meal Plan Config</h2>

              <div className="form-group">
                <label className="form-label">Fitness Goal</label>
                <select 
                  className="form-select"
                  value={mealParams.goal}
                  onChange={(e) => setMealParams({...mealParams, goal: e.target.value})}
                >
                  <option value="Lose Weight">📉 Weight Loss / Shred</option>
                  <option value="Build Muscle">📈 Lean Bulk / Muscle Gain</option>
                  <option value="Maintain Fitness">⚖️ Maintenance / Performance</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Dietary Style</label>
                <select 
                  className="form-select"
                  value={mealParams.dietType}
                  onChange={(e) => setMealParams({...mealParams, dietType: e.target.value})}
                >
                  <option value="Balanced">Balanced (Clean eating)</option>
                  <option value="High Protein">High Protein / Low Carb</option>
                  <option value="Vegan">Vegan (100% Plant-based)</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Keto">Ketogenic (Low Carb, High Fat)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Calories: {mealParams.calories} kcal</label>
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
                style={{ width: "100%", marginTop: "8px" }}
                disabled={mealGenerating}
                onClick={fetchMealPlan}
              >
                {mealGenerating ? "🍎 Designing meal plan..." : "Generate AI Meal Plan"}
              </button>
            </div>

            {/* Display Outputs */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <h2 style={{ fontSize: "1.4rem" }}>Your Diet Profile</h2>
                {mealPlan && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: "8px 16px", fontSize: "0.8rem", borderRadius: "10px" }}
                    onClick={sendWhatsAppBrief}
                    disabled={sendingWhatsApp}
                  >
                    {sendingWhatsApp ? "📲 Sending..." : "📲 Send to WhatsApp"}
                  </button>
                )}
              </div>

              {!mealPlan ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", minHeight: "280px" }}>
                  <span style={{ fontSize: "2.5rem" }}>🥗</span>
                  <p style={{ marginTop: "12px", fontSize: "0.9rem" }}>No meal plan generated.</p>
                  <p style={{ fontSize: "0.75rem" }}>Adjust parameters on the left and click Generate.</p>
                </div>
              ) : (
                <div style={{ overflowY: "auto", flex: 1, maxHeight: "420px" }}>
                  
                  {/* Macros Badges */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "12px", border: "1px solid var(--border-muted)" }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>CARBS</div>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--secondary)" }}>{mealPlan.Macros?.Carbs || "N/A"}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", borderLeft: "1px solid var(--border-muted)", borderRight: "1px solid var(--border-muted)" }}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>PROTEIN</div>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--primary)" }}>{mealPlan.Macros?.Protein || "N/A"}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>FAT</div>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--accent-orange)" }}>{mealPlan.Macros?.Fat || "N/A"}</div>
                    </div>
                  </div>

                  {/* Meal list */}
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

                  {/* Checklist */}
                  {mealPlan.Shopping && mealPlan.Shopping.length > 0 && (
                    <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-muted)", paddingTop: "14px" }}>
                      <h4 style={{ marginBottom: "10px", fontSize: "0.95rem" }}>🛒 Shopping List Checklist</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {mealPlan.Shopping.map((item: string, idx: number) => (
                          <label key={idx} style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "0.8rem", cursor: "pointer", color: "var(--text-muted)" }}>
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

      {/* Mobile Bottom Navigation Bar (PWA Essential) */}
      <nav className="mobile-nav-bar">
        <button 
          className={`mobile-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <span className="mobile-tab-btn-icon">🧘</span>
          <span>Coaches</span>
        </button>
        
        <button 
          className={`mobile-tab-btn ${activeTab === "workout" ? "active" : ""}`}
          onClick={() => setActiveTab("workout")}
        >
          <span className="mobile-tab-btn-icon">📋</span>
          <span>Builder</span>
        </button>
        
        <button 
          className={`mobile-tab-btn ${activeTab === "live" ? "active" : ""}`}
          onClick={() => {
            if (!workoutActive && !workoutPlan) {
              alert("Please generate a workout plan first!");
            } else {
              setActiveTab("live");
            }
          }}
        >
          <span className="mobile-tab-btn-icon">{workoutActive ? "🔴" : "⏱️"}</span>
          <span>{workoutActive ? "Live Session" : "Player"}</span>
        </button>
        
        <button 
          className={`mobile-tab-btn ${activeTab === "nutrition" ? "active" : ""}`}
          onClick={() => setActiveTab("nutrition")}
        >
          <span className="mobile-tab-btn-icon">🥗</span>
          <span>Diet</span>
        </button>
      </nav>
    </div>
  );
}
