"use client";

import MatchScreen from "@/components/match/MatchScreen";
import { useCallback, useEffect, useState } from "react";
import DraftScreen from "@/components/draft/DraftScreen";
import LineupScreen from "@/components/lineup/LineupScreen";
import { supabase } from "@/lib/supabase";
import { FriendGroup } from "@/types/game";

type Room = {
  id: string;
  code: string;
  status: string;
  mode: number;
  current_turn: number;
  current_group: FriendGroup | null;
  current_pick: number;
  host_name: string | null;
};

type RoomPlayer = {
  id: string;
  name: string;
  position: number;
  is_host: boolean | null;
};

export default function LobbyScreen({ code }: { code: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentName, setCurrentName] = useState("");
  const [wasRemoved, setWasRemoved] = useState(false);

  const loadRoom = useCallback(async () => {
    const savedName = sessionStorage.getItem("draftazo_player_name") || "";
    setCurrentName(savedName);

    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .single();

    if (error || !data) {
      console.error(error);
      setLoading(false);
      return;
    }

    setRoom(data);

    const { data: playersData, error: playersError } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", data.id)
      .order("position", { ascending: true });

    if (playersError) {
      console.error(playersError);
    }

    const safePlayers = playersData || [];
    setPlayers(safePlayers);

    if (savedName) {
      const stillInside = safePlayers.some(
        (player) => player.name.toLowerCase() === savedName.toLowerCase()
      );

      if (!stillInside) {
        setWasRemoved(true);
      }
    }

    setLoading(false);
  }, [code]);

  async function startDraft() {
    if (!room) return;

    if (players.length !== room.mode) {
      alert(`Faltan jugadores. Esta sala es de ${room.mode}.`);
      return;
    }

    const { error } = await supabase
      .from("rooms")
      .update({ status: "draft", current_turn: 0 })
      .eq("id", room.id);

    if (error) {
      alert("No se pudo iniciar el draft.");
      console.error(error);
      return;
    }

    await loadRoom();
  }

  async function removePlayer(playerId: string) {
    if (!room) return;

    const player = players.find((item) => item.id === playerId);

    if (!player) return;

    if (player.is_host) {
      alert("No puedes remover al host.");
      return;
    }

    const { error } = await supabase
      .from("room_players")
      .delete()
      .eq("id", playerId);

    if (error) {
      alert("No se pudo remover al jugador.");
      console.error(error);
      return;
    }

    await loadRoom();
  }

  function goHomeAfterRemoval() {
    sessionStorage.removeItem("draftazo_player_name");
    window.location.href = "/";
  }

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!room?.id) return;

    const roomChannel = supabase
      .channel(`draftazo-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        () => {
          loadRoom();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          loadRoom();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadRoom();
    }, 3000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(roomChannel);
    };
  }, [room?.id, loadRoom]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Cargando sala...
      </main>
    );
  }

  if (wasRemoved) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white p-6 flex items-center justify-center">
        <section className="w-full max-w-md bg-zinc-900 border border-red-800 rounded-2xl p-6 text-center">
          <h1 className="text-4xl font-black mb-4">Has sido removido</h1>

          <p className="text-zinc-400 mb-6">
            El anfitrión te sacó de esta sala.
          </p>

          <button
            onClick={goHomeAfterRemoval}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl p-4 font-black"
          >
            Volver al inicio
          </button>
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Sala no encontrada
      </main>
    );
  }

 if (room.status === "draft") {
  return <DraftScreen room={room} players={players} />;
}


if (room.status === "lineup") {
  return <LineupScreen room={room} players={players} />;
}

if (room.status === "match") {
  return <MatchScreen room={room} players={players} />;
}

  const isHost =
    players.find((player) => player.name === currentName)?.is_host === true;

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 flex items-center justify-center">
      <section className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h1 className="text-4xl font-black mb-2">🏆 Draftazo</h1>

        <p className="text-zinc-400 mb-2">
          Sala: <span className="text-yellow-400 font-black">{room.code}</span>
        </p>

        <p className="text-zinc-500 mb-6">
          Host: <span className="text-zinc-300">{room.host_name}</span>
        </p>

        <div className="mb-6">
          <p className="text-zinc-400 mb-3">
            Jugadores {players.length}/{room.mode}
          </p>

          <div className="space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="bg-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <span className="font-bold">{player.name}</span>
                  {player.is_host && (
                    <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-black">
                      HOST
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-zinc-500">#{player.position + 1}</span>

                  {isHost && !player.is_host && (
                    <button
                      onClick={() => removePlayer(player.id)}
                      className="text-sm bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg font-bold"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={startDraft}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl p-4 font-black"
          >
            Iniciar Draft
          </button>
        ) : (
          <div className="bg-zinc-800 rounded-xl p-4 text-center text-zinc-400">
            Esperando a que el host inicie la partida...
          </div>
        )}
      </section>
    </main>
  );
}