"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomeActions() {
  const router = useRouter();

  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<2 | 4>(2);
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    const cleanName = playerName.trim();

    if (!cleanName) {
      alert("Escribe tu nombre");
      return;
    }

    setLoading(true);

    const code = nanoid(5).toUpperCase();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code,
        mode,
        status: "lobby",
        current_turn: 0,
        host_name: cleanName,
      })
      .select()
      .single();

    if (roomError || !room) {
      alert("Error creando la sala. Revisa Supabase.");
      console.error(roomError);
      setLoading(false);
      return;
    }

    const { error: playerError } = await supabase.from("room_players").insert({
      room_id: room.id,
      name: cleanName,
      position: 0,
      is_host: true,
    });

    if (playerError) {
      alert("Error agregando jugador host.");
      console.error(playerError);
      setLoading(false);
      return;
    }

    sessionStorage.setItem("draftazo_player_name", cleanName);
    router.push(`/room/${code}`);
  }

  async function joinRoom() {
    const cleanName = playerName.trim();
    const code = roomCode.trim().toUpperCase();

    if (!cleanName || !code) {
      alert("Escribe tu nombre y el código de sala");
      return;
    }

    setLoading(true);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .single();

    if (roomError || !room) {
      alert("No existe esa sala");
      console.error(roomError);
      setLoading(false);
      return;
    }

    const { data: players, error: playersError } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room.id)
      .order("position", { ascending: true });

    if (playersError) {
      alert("Error cargando jugadores.");
      console.error(playersError);
      setLoading(false);
      return;
    }

    const alreadyJoined = (players || []).some(
      (player) => player.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (alreadyJoined) {
      sessionStorage.setItem("draftazo_player_name", cleanName);
      router.push(`/room/${code}`);
      return;
    }

    if ((players || []).length >= room.mode) {
      alert("La sala ya está llena");
      setLoading(false);
      return;
    }

    const { error: joinError } = await supabase.from("room_players").insert({
      room_id: room.id,
      name: cleanName,
      position: (players || []).length,
      is_host: false,
    });

    if (joinError) {
      alert("Error uniéndote a la sala.");
      console.error(joinError);
      setLoading(false);
      return;
    }

    sessionStorage.setItem("draftazo_player_name", cleanName);
    router.push(`/room/${code}`);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left">
      <label className="block text-sm text-zinc-400 mb-2">Tu nombre</label>
      <input
        className="w-full bg-zinc-800 rounded-xl p-3 mb-4 outline-none"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Omar"
      />

      <label className="block text-sm text-zinc-400 mb-2">Modo</label>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setMode(2)}
          className={`rounded-xl p-3 font-bold ${
            mode === 2 ? "bg-yellow-500 text-black" : "bg-zinc-800"
          }`}
        >
          1 vs 1
        </button>

        <button
          onClick={() => setMode(4)}
          className={`rounded-xl p-3 font-bold ${
            mode === 4 ? "bg-yellow-500 text-black" : "bg-zinc-800"
          }`}
        >
          4 jugadores
        </button>
      </div>

      <button
        disabled={loading}
        onClick={createRoom}
        className="w-full bg-green-600 hover:bg-green-700 rounded-xl p-3 font-black mb-6 disabled:opacity-50"
      >
        Crear sala
      </button>

      <div className="border-t border-zinc-800 pt-6">
        <label className="block text-sm text-zinc-400 mb-2">
          Código de sala
        </label>

        <input
          className="w-full bg-zinc-800 rounded-xl p-3 mb-4 outline-none uppercase"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          placeholder="ABCDE"
        />

        <button
          disabled={loading}
          onClick={joinRoom}
          className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl p-3 font-black disabled:opacity-50"
        >
          Unirme
        </button>
      </div>
    </div>
  );
}
