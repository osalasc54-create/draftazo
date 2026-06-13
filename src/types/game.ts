export type FriendGroup = "CAPITANES" | "PICHIS";

export type Position = "POR" | "DEF" | "MED" | "DEL" | "COM";

export type FieldSlot = "POR" | "DEF" | "MED" | "DEL";

export type Friend = {
  id: string;
  name: string;
  rating: number;
  position: Position;
  group: FriendGroup;
};

export type DraftPick = {
  playerName: string;
  friendId: string;
};
