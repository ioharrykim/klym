import { useEffect, useState } from 'react';
import { readJson, storageKeys, uid, writeJson } from '../lib/storage';
import type { SendCard } from '../types/klym';

export function useSendCards() {
  const [sendCards, setSendCards] = useState<SendCard[]>(() =>
    stripPrototypeCards(readJson<SendCard[]>(storageKeys.sendCards, [])),
  );

  useEffect(() => writeJson(storageKeys.sendCards, sendCards), [sendCards]);

  function saveSendCard(card: Omit<SendCard, 'id' | 'createdAt'>) {
    const next: SendCard = {
      ...card,
      id: uid('card'),
      createdAt: new Date().toISOString(),
    };
    setSendCards((current) => [next, ...current]);
    return next;
  }

  function updateSendCard(id: string, patch: Partial<SendCard>) {
    setSendCards((current) => current.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  }

  return { sendCards, saveSendCard, updateSendCard };
}

const prototypeProjectIds = new Set([
  'project_concrete_traverse',
  'project_crimson_dyno',
  'project_graphite_slab',
  'project_paper_tiger',
  'project_night_shift',
  'project_street_line',
]);

function stripPrototypeCards(cards: SendCard[]) {
  if (cards.some((card) => prototypeProjectIds.has(card.projectId))) return [];
  return cards;
}
