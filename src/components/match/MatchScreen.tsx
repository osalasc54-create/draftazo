"use client";

import { useEffect, useState } from "react";
import { friends } from "@/data/friends";
import { calculateTeamPower, generateMatchEvents } from "@/lib/gameLogic";
import { supabase } from "@/lib/supabase";
import { FieldSlot, Friend } from "@/types/game";

type Room = {
  id: string;
  code: string;
  status: string;
  mode: number;
};

type RoomPlayer = {
  id: string;
  name: string;
  position: number;
  is_host?: boolean | null;
};

type LineupRow = {
  player_name: string;
  slot: FieldSlot;
  friend_id: string;
};

type Props = {
  room: Room;
  players: RoomPlayer[];
};

type SavedMatch = {
  playerA: string;
  playerB: string;
  powerA: number;
  powerB: number;
  winner: string;
  events: {
    minute: number;
    text: string;
    team: string;
    type: "goal" | "save" | "chance";
  }[];
};

export default function MatchScreen({ room, players }: Props) {
  const [match, setMatch] = useState<SavedMatch | null>(null);
  const [minute, setMinute] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentName =
    typeof window !== "undefined"
      ? sessionStorage.getItem("draftazo_player_name") || ""
      : "";

  const isHost =
    players.find((player) => player.name === currentName)?.is_host === true;

  async function loadOrCreateMatch() {
    const { data: existing } = await supabase
      .from("match_results")
      .select("*")
      .eq("room_id", room.id)
      .maybeSingle();

    if (existing?.data) {
      setMatch(existing.data as SavedMatch);
      setLoading(false);
      return;
    }

    const { data: lineups } = await supabase
      .from("lineups")
      .select("*")
      .eq("room_id", room.id);

    const safeLineups = (lineups || []) as LineupRow[];

    const playerA = players[0];
    const playerB = players[1];

    const buildTeam = (playerName: string) => {
      return safeLineups
        .filter((item) => item.player_name === playerName)
        .map((row) => {
          const friend = friends.find((item) => item.id === row.friend_id) as Friend;

          return {
            slot: row.slot,
            friend,
          };
        });
    };

    const teamA = buildTeam(playerA.name);
    const teamB = buildTeam(playerB.name);

    const powerA = calculateTeamPower(teamA);
    const powerB = calculateTeamPower(teamB);

    const result = generateMatchEvents(
      playerA.name,
      playerB.name,
      powerA.power,
      powerB.power,
      teamA.map((item) => item.friend.name),
      teamB.map((item) => item.friend.name)
    );

    const newMatch: SavedMatch = {
      playerA: playerA.name,
      playerB: playerB.name,
      powerA: powerA.power,
      powerB: powerB.power,
      winner: result.winner,
      events: result.events,
    };

    await supabase.from("match_results").insert({
      room_id: room.id,
      data: newMatch,
    });

    setMatch(newMatch);
    setLoading(false);
  }

  async function resetGameData() {
    await supabase.from("draft_state").delete().eq("room_id", room.id);
    await supabase.from("lineups").delete().eq("room_id", room.id);
    await supabase.from("match_results").delete().eq("room_id", room.id);
  }

  async function backToLobby() {
    if (!isHost) return;

    await resetGameData();

    await supabase
      .from("rooms")
      .update({
        status: "lobby",
        current_turn: 0,
        current_pick: 1,
        current_group: null,
      })
      .eq("id", room.id);
  }

  async function playAgain() {
    if (!isHost) return;

    await resetGameData();

    await supabase
      .from("rooms")
      .update({
        status: "draft",
        current_turn: 0,
        current_pick: 1,
        current_group: null,
      })
      .eq("id", room.id);
  }

  function exitToHome() {
    window.location.href = "/";
  }

  useEffect(() => {
    loadOrCreateMatch();
  }, []);

  useEffect(() => {
    if (!started) return;

    const interval = setInterval(() => {
      setMinute((prev) => {
        if (prev >= 50) {
          clearInterval(interval);
          return 50;
        }

        return prev + 1;
      });
    }, 350);

    return () => clearInterval(interval);
  }, [started]);

  if (loading || !match) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Cargando partido...
      </main>
    );
  }

  const visibleEvents = match.events.filter((event) => event.minute <= minute);

  const goalsA = visibleEvents.filter(
    (event) => event.type === "goal" && event.team === match.playerA
  ).length;

  const goalsB = visibleEvents.filter(
    (event) => event.type === "goal" && event.team === match.playerB
  ).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <section className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-black mb-2">🏆 Draftazo</h1>
          <p className="text-zinc-400">Final · Minuto {minute}'</p>
        </header>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-3 items-center text-center gap-4">
            <div>
              <h2 className="text-2xl font-black">{match.playerA}</h2>
              <p className="text-zinc-400">Poder {match.powerA}</p>
            </div>

            <div className="text-5xl font-black text-yellow-400">
              {goalsA} - {goalsB}
            </div>

            <div>
              <h2 className="text-2xl font-black">{match.playerB}</h2>
              <p className="text-zinc-400">Poder {match.powerB}</p>
            </div>
          </div>

          {!started && (
            <button
              onClick={() => setStarted(true)}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl p-4 font-black mt-8"
            >
              Iniciar partido
            </button>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-xl font-black mb-4">Eventos</h3>

          <div className="space-y-3">
            {visibleEvents.map((event, index) => (
              <div key={index} className="bg-zinc-800 rounded-xl p-4">
                <span className="text-yellow-400 font-black">{event.minute}'</span>{" "}
                {event.text}
              </div>
            ))}
          </div>
        </div>

        {minute >= 50 && (
          <div className="mt-6 bg-yellow-500 text-black rounded-2xl p-6 text-center">
            <h2 className="text-4xl font-black mb-6">
              🏆 Campeón: {match.winner}
            </h2>

            {isHost ? (
              <div className="grid md:grid-cols-3 gap-3">
                <button
                  onClick={backToLobby}
                  className="bg-black text-white rounded-xl p-4 font-black"
                >
                  Volver al lobby
                </button>

                <button
                  onClick={playAgain}
                  className="bg-green-700 text-white rounded-xl p-4 font-black"
                >
                  Volver a jugar
                </button>

                <button
                  onClick={exitToHome}
                  className="bg-zinc-800 text-white rounded-xl p-4 font-black"
                >
                  Salir al inicio
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-bold">
                  Esperando decisión del host...
                </p>

                <button
                  onClick={exitToHome}
                  className="w-full bg-black text-white rounded-xl p-4 font-black"
                >
                  Salir al inicio
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
