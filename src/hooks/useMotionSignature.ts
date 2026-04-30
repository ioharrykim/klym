import { useEffect, useMemo, useState } from 'react';
import { storageKeys, uid, writeJson, readJson } from '../lib/storage';
import type { MotionSignatureData, MotionSignatureStyle } from '../types/klym';

export function useMotionSignature() {
  const [signatures, setSignatures] = useState<MotionSignatureData[]>(() =>
    compactSignatures(stripPrototypeSignatures(readJson<MotionSignatureData[]>(storageKeys.signatures, []))),
  );

  useEffect(() => writeJson(storageKeys.signatures, signatures), [signatures]);

  function saveSignature(signature: Omit<MotionSignatureData, 'id' | 'createdAt'>) {
    const next: MotionSignatureData = {
      ...signature,
      id: uid('signature'),
      createdAt: new Date().toISOString(),
    };
    const compact = compactSignature(next);
    setSignatures((current) => [compact, ...current]);
    return next;
  }

  function updateSignature(id: string, patch: Partial<MotionSignatureData>) {
    setSignatures((current) =>
      current.map((signature) => (signature.id === id ? compactSignature({ ...signature, ...patch }) : signature)),
    );
  }

  function deleteSignature(id: string) {
    setSignatures((current) => current.filter((signature) => signature.id !== id));
  }

  function setSignatureStyle(id: string, style: MotionSignatureStyle) {
    updateSignature(id, { style });
  }

  const latestByProject = useMemo(() => {
    const map = new Map<string, MotionSignatureData>();
    signatures.forEach((signature) => {
      if (!signature.projectId) return;
      if (!map.has(signature.projectId)) map.set(signature.projectId, signature);
    });
    return map;
  }, [signatures]);

  return {
    signatures,
    latestByProject,
    saveSignature,
    updateSignature,
    deleteSignature,
    setSignatureStyle,
  };
}

const prototypeProjectIds = new Set([
  'project_concrete_traverse',
  'project_crimson_dyno',
  'project_graphite_slab',
  'project_paper_tiger',
  'project_night_shift',
  'project_street_line',
]);

function stripPrototypeSignatures(signatures: MotionSignatureData[]) {
  if (signatures.some((signature) => signature.projectId && prototypeProjectIds.has(signature.projectId))) return [];
  return signatures;
}

function compactSignatures(signatures: MotionSignatureData[]) {
  return signatures.map(compactSignature);
}

function compactSignature(signature: MotionSignatureData): MotionSignatureData {
  const { videoDataUrl: _videoDataUrl, sourceVideoUrl: _sourceVideoUrl, ...compact } = signature;
  return compact;
}
