import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SockJS from "sockjs-client/dist/sockjs";
import Stomp from "stompjs";
import { API } from "../api";
import Header from "../components/Header";
import ChatBox from "../components/ChatBox";
import PlayerGestureLayer from "../components/PlayerGestureLayer";

export default function RoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const stompClientRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [allMovies, setAllMovies] = useState([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState("AUTO");

  const userName = localStorage.getItem("userName") || "Guest";

  useEffect(() => {
    loadRoom();
    loadMovies();
    connectSocket();

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.disconnect(() => {});
      }
    };
  }, [roomCode]);

  // ✅ Load room
  const loadRoom = async () => {
    try {
      const res = await API.get(`/rooms/${roomCode}`);
      setRoom(res.data);
      setSelectedMovie(res.data.movie || null);
      setSelectedQuality(res.data.currentQuality || "AUTO");
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Load all movies
  const loadMovies = async () => {
    try {
      const res = await API.get("/movies");
      setAllMovies(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ WebSocket
  const connectSocket = () => {
    const socket = new SockJS("http://localhost:8080/ws");
    const client = Stomp.over(socket);
    client.debug = () => {};

    client.connect({}, () => {
      // sync playback
      client.subscribe(`/topic/room/${roomCode}`, (message) => {
        const data = JSON.parse(message.body);

        if (!videoRef.current) return;

        if (typeof data.currentTime === "number") {
          const diff = Math.abs(
            (videoRef.current.currentTime || 0) - data.currentTime
          );
          if (diff > 2) {
            videoRef.current.currentTime = data.currentTime;
          }
        }

        if (data.action === "PLAY") {
          videoRef.current.play().catch(() => {});
        }

        if (data.action === "PAUSE") {
          videoRef.current.pause();
        }

        if (data.action === "RATE" && data.playbackRate) {
          videoRef.current.playbackRate = data.playbackRate;
        }

        if (data.quality) {
          setSelectedQuality(data.quality);
        }
      });

      // chat
      client.subscribe(`/topic/chat/${roomCode}`, (message) => {
        const data = JSON.parse(message.body);
        setMessages((prev) => [...prev, data]);
      });
    });

    stompClientRef.current = client;
  };

  // ✅ send sync
  const sendSync = (payload) => {
    if (!stompClientRef.current) return;

    stompClientRef.current.send(
      "/app/room.sync",
      {},
      JSON.stringify({
        roomCode,
        ...payload,
      })
    );
  };

  // ✅ send chat
  const sendChat = (text) => {
    if (!stompClientRef.current || !text.trim()) return;

    stompClientRef.current.send(
      "/app/room.chat",
      {},
      JSON.stringify({
        roomCode,
        sender: userName,
        text,
      })
    );
  };

  // ✅ video controls
  const handlePlay = () => {
    sendSync({
      action: "PLAY",
      currentTime: videoRef.current?.currentTime || 0,
      quality: selectedQuality,
    });
  };

  const handlePause = () => {
    sendSync({
      action: "PAUSE",
      currentTime: videoRef.current?.currentTime || 0,
      quality: selectedQuality,
    });
  };

  const seekTo = (time) => {
    if (!videoRef.current) return;

    videoRef.current.currentTime = time;

    sendSync({
      action: "SEEK",
      currentTime: time,
      quality: selectedQuality,
    });
  };

  // ✅ FULL SCREEN FUNCTION
  const goFullScreen = () => {
    if (!videoRef.current) return;

    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    } else if (videoRef.current.msRequestFullscreen) {
      videoRef.current.msRequestFullscreen();
    }
  };

  // ✅ switch movie
  const handleMovieSwitch = async (movie) => {
    setSelectedMovie(movie);

    try {
      await API.put(`/rooms/${roomCode}/movie`, {
        movieId: movie.id,
      });

      setTimeout(() => loadRoom(), 300);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ search filter
  const filteredMovies = useMemo(() => {
    const value = roomSearch.toLowerCase();

    return allMovies.filter(
      (movie) =>
        movie.groupTitle?.toLowerCase().includes(value) ||
        movie.partTitle?.toLowerCase().includes(value) ||
        String(movie.partNumber || "").includes(value)
    );
  }, [allMovies, roomSearch]);

  return (
    <div className="page room-shell">
      <Header userName={userName} />

      {/* TOP BAR */}
      <div className="room-topbar">
        <div className="room-code-pill">Room: {roomCode}</div>

        <input
          className="input-modern"
          placeholder="Search movies..."
          value={roomSearch}
          onChange={(e) => setRoomSearch(e.target.value)}
        />

        <button onClick={() => navigate("/home")}>
          Back
        </button>
      </div>

      <div className="room-page">
        {/* LEFT SIDE */}
        <div className="room-main-area">
          <div className="room-video-card">
            {selectedMovie ? (
              <>
                <h2>{selectedMovie.groupTitle}</h2>
                <p>{selectedMovie.partTitle}</p>

                <video
                  ref={videoRef}
                  src={`http://localhost:8080${selectedMovie.videoUrl}`}
                  controls
                  onPlay={handlePlay}
                  onPause={handlePause}
                />

                {/* ACTION BUTTONS */}
                <div className="room-action-row">
                  <button onClick={goFullScreen}>
                    Full Screen
                  </button>

                  <a
                    href={`http://localhost:8080${selectedMovie.videoUrl}`}
                    download
                  >
                    <button>
                      Download
                    </button>
                  </a>
                </div>
              </>
            ) : (
              <div>
                Room created successfully. Select a movie below.
              </div>
            )}
          </div>

          {/* MOVIE LIST */}
          <div>
            {filteredMovies.map((movie) => (
              <button
                key={movie.id}
                onClick={() => handleMovieSwitch(movie)}
              >
                {movie.groupTitle} - {movie.partTitle}
              </button>
            ))}
          </div>
        </div>

        {/* CHAT */}
        <ChatBox messages={messages} onSend={sendChat} />
      </div>
    </div>
  );
}