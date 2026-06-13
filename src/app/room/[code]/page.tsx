import LobbyScreen from "@/components/lobby/LobbyScreen";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

export default async function RoomPage({ params }: Props) {
  const { code } = await params;

  return <LobbyScreen code={code} />;
}
