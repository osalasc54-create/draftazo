import { friends } from "@/data/friends";
import { FieldSlot, Friend, FriendGroup } from "@/types/game";

export function getSquadSize(totalPlayers: number) {
  if (totalPlayers === 2) return 7;
  if (totalPlayers === 4) return 5;
  return 0;
}

export function getFormation(totalPlayers: number): FieldSlot[] {
  if (totalPlayers === 2) {
    return ["POR", "DEF", "DEF", "MED", "MED", "DEL", "DEL"];
  }

  if (totalPlayers === 4) {
    return ["POR", "DEF", "DEF", "MED", "DEL"];
  }

  return [];
}

export function rollGroup(): FriendGroup {
  return Math.random() < 0.5 ? "CAPITANES" : "PICHIS";
}

export function getAvailableFriends(group: FriendGroup, selectedFriendIds: string[]) {
  return friends.filter(
    (friend) => friend.group === group && !selectedFriendIds.includes(friend.id)
  );
}

export function getFriendById(id: string) {
  return friends.find((friend) => friend.id === id);
}

export function getAdjustedRating(friend: Friend, slot: FieldSlot) {
  if (friend.position === "COM") {
    return slot === "POR" ? friend.rating - 5 : friend.rating;
  }

  if (slot === friend.position) {
    return friend.rating;
  }

  if (slot === "POR") {
    return friend.rating - 12;
  }

  if (friend.position === "POR") {
    return friend.rating - 10;
  }

  return friend.rating - 4;
}

export function getChemistry(friend: Friend, slot: FieldSlot) {
  if (friend.position === "COM") return 1;
  return friend.position === slot ? 1 : 0;
}

export function calculateTeamPower(
  lineup: { friend: Friend; slot: FieldSlot }[]
) {
  const adjustedRatings = lineup.map((item) =>
    getAdjustedRating(item.friend, item.slot)
  );

  const average =
    adjustedRatings.reduce((sum, rating) => sum + rating, 0) /
    adjustedRatings.length;

  const chemistry = lineup.reduce(
    (sum, item) => sum + getChemistry(item.friend, item.slot),
    0
  );

  return {
    average: Math.round(average),
    chemistry,
    power: Math.round(average + chemistry),
  };
}

export type MatchEvent = {
  minute: number;
  text: string;
  team: string;
  type: "goal" | "save" | "chance";
};

export function generateMatchEvents(
  teamA: string,
  teamB: string,
  powerA: number,
  powerB: number,
  playersA: string[],
  playersB: string[]
) {
  const luckA = Math.floor(Math.random() * 11) - 5;
  const luckB = Math.floor(Math.random() * 11) - 5;

  const finalPowerA = powerA + luckA;
  const finalPowerB = powerB + luckB;

  let goalsA = Math.max(0, Math.floor((finalPowerA - 80) / 7));
  let goalsB = Math.max(0, Math.floor((finalPowerB - 80) / 7));

  if (Math.random() < 0.35) goalsA++;
  if (Math.random() < 0.35) goalsB++;

  if (goalsA === goalsB) {
    if (finalPowerA >= finalPowerB) goalsA++;
    else goalsB++;
  }

  const events: MatchEvent[] = [];

  for (let i = 0; i < goalsA; i++) {
    const scorer = playersA[Math.floor(Math.random() * playersA.length)];
    events.push({
      minute: Math.floor(Math.random() * 50) + 1,
      text: `Gol de ${scorer} ⚽`,
      team: teamA,
      type: "goal",
    });
  }

  for (let i = 0; i < goalsB; i++) {
    const scorer = playersB[Math.floor(Math.random() * playersB.length)];
    events.push({
      minute: Math.floor(Math.random() * 50) + 1,
      text: `Gol de ${scorer} ⚽`,
      team: teamB,
      type: "goal",
    });
  }

  events.push({
    minute: Math.floor(Math.random() * 50) + 1,
    text: "Atajada espectacular 🧤",
    team: Math.random() > 0.5 ? teamA : teamB,
    type: "save",
  });

  return {
    scoreA: goalsA,
    scoreB: goalsB,
    winner: goalsA > goalsB ? teamA : teamB,
    events: events.sort((a, b) => a.minute - b.minute),
  };
}
