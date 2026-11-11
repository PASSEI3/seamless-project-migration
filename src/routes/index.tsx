import { createFileRoute } from "@tanstack/react-router";
import { LivreiApp } from "@/livrei/LivreiApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LIVREI — Troca de livros perto de você" },
      {
        name: "description",
        content:
          "Troque livros com leitores da sua cidade: dê match, combine a entrega e ganhe moedas pelo seu acervo.",
      },
      { property: "og:title", content: "LIVREI — Troca de livros perto de você" },
      {
        property: "og:description",
        content:
          "Troque livros com leitores da sua cidade: dê match, combine a entrega e ganhe moedas pelo seu acervo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivreiApp,
});
