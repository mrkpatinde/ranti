import type { Metadata } from "next";
import Landing from "./_components/landing";

export const metadata: Metadata = {
  description:
    "Ranti, le registre de loyer des propriétaires africains : suivez qui a payé, relancez vos locataires à votre place et éditez vos quittances. Vous validez, c'est tout.",
};

export default function Home() {
  return <Landing />;
}
