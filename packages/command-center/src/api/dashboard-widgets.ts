// Lightweight file-backed state for home-dashboard widgets (quick-capture notes;
// the weather chip's location now lives in @wireassist/core's weather-settings). Same pattern as ops/src/trust-stage.ts —
// small JSON files under WIREASSIST_HOME, not worth a SQLite table for.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const HOME = process.env.WIREASSIST_HOME ?? homedir();

export interface QuickNote {
  id: string;
  text: string;
  createdAt: string;
}

const NOTES_PATH = join(HOME, '.wireassist', 'dashboard-notes.json');
const MAX_NOTES = 20;

function readNotes(): QuickNote[] {
  if (!existsSync(NOTES_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(NOTES_PATH, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotes(notes: QuickNote[]): void {
  mkdirSync(dirname(NOTES_PATH), { recursive: true });
  writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2));
}

export function listNotes(): QuickNote[] {
  return readNotes();
}

export function addNote(text: string): QuickNote {
  const note: QuickNote = { id: randomUUID(), text, createdAt: new Date().toISOString() };
  const notes = [note, ...readNotes()].slice(0, MAX_NOTES);
  writeNotes(notes);
  return note;
}

export function deleteNote(id: string): void {
  writeNotes(readNotes().filter((n) => n.id !== id));
}
