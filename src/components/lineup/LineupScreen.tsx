"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friends } from "@/data/friends";
import { calculateTeamPower, getAdjustedRating, getFormation } from "@/lib/gameLogic";
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
};

type DraftState = {
  friend_id: string;
  picked_by: string;
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

export default function LineupScreen({ room, players }: Props) {
  const [picks, setPicks] = useState<DraftState[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const currentName =
    typeof window !== "undefined"
      ? sessionStorage.getItem("draftazo_player_name") || ""
      : "";

  const formation = getFormation(room.mode);

  const myFriends = useMemo(() => {
    return picks
      .filter((pick) => pick.picked_by === currentName)
      .map((pick) => friends.find((friend) => friend.id === pick.friend_id))
      .filter(Boolean) as Friend[];
  }, [picks, currentName]);

  const myLineup = formation
    .map((slot, index) => {
      const friendId = selected[index];
      const friend = friends.find((item) => item.id === friendId);

      if (!friend) return null;

      return {
        slot,
        friend,
      };
    })
    .filter(Boolean) as { slot: FieldSlot; friend: Friend }[];

  const teamPower =
    myLineup.length === formation.length ? calculateTeamPower(myLineup) : null;

  const loadLineup = useCallback(async () => {
    const { data: picksData } = await supabase
      .from("draft_state")
      .select("*")
      .eq("room_id", room.id);

    setPicks(picksData || []);

    const { data: lineupData } = await supabase
      .from("lineups")
      .select("*")
      .eq("room_id", room.id);

    const safeLineups = lineupData || [];
    setLineups(safeLineups);

    const existingMine = safeLineups.filter(
      (item) => item.player_name === currentName
    );

    if (existingMine.length > 0) {
      const restored: Record<number, string> = {};

      formation.forEach((slot, index) => {
        const found = existingMine.find((item) => item.slot === slot);
        if (found) restored[index] = found.friend_id;
      });

      setSelected(restored);
      setSaved(existingMine.length === formation.length);
    }

    setLoading(false);
  }, [room.id, currentName, formation.join(",")]);

  function selectFriend(slotIndex: number, friendId: string) {
    setSaved(false);
    setSelected((prev) => ({
      ...prev,
      [slotIndex]: friendId,
    }));
  }

  async function saveLineup() {
    if (myLineup.length !== formation.length) {
      alert("Completa toda tu alineación.");
      return;
    }

    const usedIds = Object.values(selected);
    const hasDuplicates = new Set(usedIds).size !== usedIds.length;

    if (hasDuplicates) {
      alert("No puedes repetir jugadores en tu alineación.");
      return;
    }

    await supabase
      .from("lineups")
      .delete()
      .eq("room_id", room.id)
      .eq("player_name", currentName);

    const rows = myLineup.map((item) => ({
      room_id: room.id,
      player_name: currentName,
      slot: item.slot,
      friend_id: item.friend.id,
    }));

    const { error } = await supabase.from("lineups").insert(rows);

    if (error) {
      alert("No se pudo guardar la alineación.");
      console.error(error);
      return;
    }

    setSaved(true);

    const { data: allLineups } = await supabase
      .from("lineups")
      .select("*")
      .eq("room_id", room.id);

    const totalNeeded = players.length * formation.length;

    if ((allLineups || []).length >= totalNeeded) {
      await supabase
        .from("rooms")
        .update({ status: "match" })
        .eq("id", room.id);
    }

    await loadLineup();
  }

  useEffect(() => {
    loadLineup();
  }, [loadLineup]);

  useEffect(() => {
    const channel = supabase
      .channel(`draftazo-lineup-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lineups",
          filter: `room_id=eq.${room.id}`,
        },
        () => loadLineup()
      )
      .subscribe();

    const interval = setInterval(loadLineup, 3000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [room.id, loadLineup]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Cargando alineación...
      </main>
    );
  }

  const readyPlayers = players.filter((player) => {
    const playerRows = lineups.filter((item) => item.player_name === player.name);
    return playerRows.length === formation.length;
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <section className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-4xl font-black">⚽ Alineación</h1>
          <p className="text-zinc-400">
            Acomoda tus jugadores antes del partido.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-2xl font-black mb-6">
              Equipo de {currentName}
            </h2>

            <div className="space-y-4">
              {formation.map((slot, index) => {
                const selectedFriend = friends.find(
                  (friend) => friend.id === selected[index]
                );

                const usedInOtherSlot = Object.entries(selected)
                  .filter(([slotKey]) => Number(slotKey) !== index)
                  .map(([, friendId]) => friendId);

                return (
                  <div key={index} className="bg-zinc-800 rounded-xl p-4">
                    <label className="block text-yellow-400 font-black mb-2">
                      {slot}
                    </label>

                    <select
                      className="w-full bg-zinc-900 rounded-xl p-3 outline-none"
                      value={selected[index] || ""}
                      onChange={(event) => selectFriend(index, event.target.value)}
                    >
                      <option value="">Seleccionar jugador</option>

                      {myFriends.map((friend) => (
                        <option
                          key={friend.id}
                          value={friend.id}
                          disabled={usedInOtherSlot.includes(friend.id)}
                        >
                          {friend.name} · {friend.rating} · {friend.position}
                        </option>
                      ))}
                    </select>

                    {selectedFriend && (
                      <p className="text-sm text-zinc-400 mt-2">
                        Media ajustada:{" "}
                        <span className="text-white font-bold">
                          {getAdjustedRating(selectedFriend, slot)}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={saveLineup}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl p-4 font-black mt-6"
            >
              Guardar alineación
            </button>
          </div>

          <aside className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-black text-xl mb-4">Resumen</h3>

              {teamPower ? (
                <div className="space-y-3">
                  <p>
                    Media:{" "}
                    <span className="text-yellow-400 font-black">
                      {teamPower.average}
                    </span>
                  </p>

                  <p>
                    Química:{" "}
                    <span className="text-yellow-400 font-black">
                      +{teamPower.chemistry}
                    </span>
                  </p>

                  <p>
                    Poder base:{" "}
                    <span className="text-yellow-400 font-black">
                      {teamPower.power}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-zinc-400">
                  Completa la alineación para ver tu poder.
                </p>
              )}

              {saved && (
                <div className="mt-4 bg-green-900/40 border border-green-700 rounded-xl p-3 text-green-300">
                  Alineación guardada.
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-black text-xl mb-4">
                Listos {readyPlayers.length}/{players.length}
              </h3>

              <div className="space-y-2">
                {players.map((player) => {
                  const isReady = readyPlayers.some(
                    (item) => item.name === player.name
                  );

                  return (
                    <div
                      key={player.id}
                      className="bg-zinc-800 rounded-xl p-3 flex justify-between"
                    >
                      <span>{player.name}</span>
                      <span>{isReady ? "✅" : "⏳"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
