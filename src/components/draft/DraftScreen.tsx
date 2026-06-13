"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friends } from "@/data/friends";
import { getAvailableFriends, getSquadSize, rollGroup } from "@/lib/gameLogic";
import { supabase } from "@/lib/supabase";
import { Friend, FriendGroup } from "@/types/game";

type Room = {
  id: string;
  code: string;
  status: string;
  mode: number;
  current_turn: number;
  current_group: FriendGroup | null;
  current_pick: number;
};

type RoomPlayer = {
  id: string;
  name: string;
  position: number;
  is_host: boolean | null;
};

type DraftState = {
  id: string;
  room_id: string;
  friend_id: string;
  picked_by: string;
  pick_number: number;
};

type Props = {
  room: Room;
  players: RoomPlayer[];
};

function getSnakePlayerIndex(pickIndex: number, playerCount: number) {
  const round = Math.floor(pickIndex / playerCount);
  const indexInRound = pickIndex % playerCount;

  if (round % 2 === 0) return indexInRound;
  return playerCount - 1 - indexInRound;
}

export default function DraftScreen({ room, players }: Props) {
  const [currentRoom, setCurrentRoom] = useState(room);
  const [picks, setPicks] = useState<DraftState[]>([]);
  const [loading, setLoading] = useState(true);

  const currentName =
    typeof window !== "undefined"
      ? sessionStorage.getItem("draftazo_player_name") || ""
      : "";

  const squadSize = getSquadSize(currentRoom.mode);
  const totalPicks = squadSize * currentRoom.mode;

  const currentPickIndex = Math.max((currentRoom.current_pick || 1) - 1, 0);
  const currentPlayerIndex = getSnakePlayerIndex(
    currentPickIndex,
    players.length
  );
  const currentPlayer = players[currentPlayerIndex];

  const isMyTurn =
    currentPlayer?.name?.toLowerCase() === currentName.toLowerCase();

  const selectedFriendIds = picks.map((pick) => pick.friend_id);

  const availableFriends = useMemo(() => {
    if (!currentRoom.current_group) return [];

    return getAvailableFriends(
      currentRoom.current_group,
      selectedFriendIds
    );
  }, [currentRoom.current_group, selectedFriendIds.join(",")]);

  const draftFinished = picks.length >= totalPicks;

  const loadDraft = useCallback(async () => {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", room.id)
      .single();

    if (roomData) {
      setCurrentRoom(roomData);
    }

    const { data: picksData } = await supabase
      .from("draft_state")
      .select("*")
      .eq("room_id", room.id)
      .order("pick_number", { ascending: true });

    setPicks(picksData || []);
    setLoading(false);
  }, [room.id]);

  async function handleRoll() {
  if (!isMyTurn || currentRoom.current_group) return;

  const selectedIds = picks.map((pick) => pick.friend_id);

  const firstGroup = rollGroup();
  const secondGroup = firstGroup === "CAPITANES" ? "PICHIS" : "CAPITANES";

  const firstAvailable = getAvailableFriends(firstGroup, selectedIds);
  const secondAvailable = getAvailableFriends(secondGroup, selectedIds);

  let finalGroup: FriendGroup | null = null;

  if (firstAvailable.length > 0) {
    finalGroup = firstGroup;
  } else if (secondAvailable.length > 0) {
    finalGroup = secondGroup;
  }

  if (!finalGroup) {
    await supabase
      .from("rooms")
      .update({ status: "lineup" })
      .eq("id", currentRoom.id);

    await loadDraft();
    return;
  }

  const { error } = await supabase
    .from("rooms")
    .update({ current_group: finalGroup })
    .eq("id", currentRoom.id);

  if (error) {
    alert("No se pudo hacer el roll.");
    console.error(error);
    return;
  }

  await loadDraft();
}

  async function chooseFriend(friend: Friend) {
    if (!isMyTurn || !currentRoom.current_group) return;

    const alreadyPicked = picks.some((pick) => pick.friend_id === friend.id);

    if (alreadyPicked) {
      alert("Ese jugador ya fue elegido.");
      return;
    }

    const pickNumber = currentRoom.current_pick || 1;

    const { error: pickError } = await supabase.from("draft_state").insert({
      room_id: currentRoom.id,
      friend_id: friend.id,
      picked_by: currentPlayer.name,
      pick_number: pickNumber,
    });

    if (pickError) {
      alert("No se pudo elegir jugador.");
      console.error(pickError);
      return;
    }

    const nextPick = pickNumber + 1;

    const nextStatus = nextPick > totalPicks ? "lineup" : "draft";

    const { error: roomError } = await supabase
      .from("rooms")
      .update({
        current_pick: nextPick,
        current_group: null,
        status: nextStatus,
      })
      .eq("id", currentRoom.id);

    if (roomError) {
      alert("No se pudo avanzar turno.");
      console.error(roomError);
      return;
    }

    await loadDraft();
  }

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    const channel = supabase
      .channel(`draftazo-draft-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        () => loadDraft()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "draft_state",
          filter: `room_id=eq.${room.id}`,
        },
        () => loadDraft()
      )
      .subscribe();

    const interval = setInterval(loadDraft, 3000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [room.id, loadDraft]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Cargando draft...
      </main>
    );
  }

  if (currentRoom.status === "lineup" || draftFinished) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <h1 className="text-4xl font-black mb-4">Draft terminado</h1>
          <p className="text-zinc-400">
            Siguiente paso: pantalla de alineación.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <section className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-4xl font-black">🎲 Draftazo</h1>
          <p className="text-zinc-400">
            Pick #{currentRoom.current_pick} / {totalPicks}
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <p className="text-zinc-400 mb-2">Turno actual</p>

            <h2 className="text-3xl font-black mb-6">
              {currentPlayer?.name}
              {isMyTurn && (
                <span className="ml-3 text-sm bg-yellow-500 text-black px-3 py-1 rounded-full">
                  TU TURNO
                </span>
              )}
            </h2>

            {!currentRoom.current_group ? (
              <button
                onClick={handleRoll}
                disabled={!isMyTurn}
                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black rounded-xl p-4 font-black mb-6"
              >
                🎲 Hacer Roll
              </button>
            ) : (
              <div className="mb-6">
                <p className="text-zinc-400 mb-2">Categoría</p>
                <div className="text-3xl font-black text-yellow-400">
                  {currentRoom.current_group}
                </div>
              </div>
            )}

            {currentRoom.current_group && (
              <div>
                <h3 className="font-bold mb-3">Disponibles</h3>

                <div className="grid sm:grid-cols-2 gap-3">
                  {availableFriends.map((friend) => (
                    <button
                      key={friend.id}
                      disabled={!isMyTurn}
                      onClick={() => chooseFriend(friend)}
                      className="bg-zinc-800 hover:bg-zinc-700 disabled:hover:bg-zinc-800 disabled:opacity-60 rounded-xl p-4 text-left"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-black">{friend.name}</span>
                        <span className="text-yellow-400 font-black">
                          {friend.rating}
                        </span>
                      </div>

                      <p className="text-zinc-400 text-sm">
                        {friend.position}
                      </p>
                    </button>
                  ))}
                </div>

                {availableFriends.length === 0 && (
                  <p className="text-zinc-500">
                    No quedan jugadores disponibles en esta categoría.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {players.map((player) => {
              const playerPicks = picks
                .filter((pick) => pick.picked_by === player.name)
                .map((pick) => friends.find((friend) => friend.id === pick.friend_id))
                .filter(Boolean) as Friend[];

              return (
                <div
                  key={player.id}
                  className={`bg-zinc-900 border rounded-2xl p-4 ${
                    player.name === currentPlayer?.name
                      ? "border-yellow-500"
                      : "border-zinc-800"
                  }`}
                >
                  <h3 className="font-black mb-3">
                    Equipo de {player.name}
                  </h3>

                  <div className="space-y-2">
                    {Array.from({ length: squadSize }).map((_, index) => {
                      const friend = playerPicks[index];

                      return (
                        <div
                          key={index}
                          className="bg-zinc-800 rounded-xl p-3 flex justify-between"
                        >
                          <span>
                            {index + 1}. {friend ? friend.name : "Vacío"}
                          </span>

                          {friend && (
                            <span className="text-yellow-400 font-bold">
                              {friend.rating}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
