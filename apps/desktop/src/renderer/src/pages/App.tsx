import { useEffect, useState, type KeyboardEvent } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import InboxIcon from "@mui/icons-material/Inbox";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import toast from "react-hot-toast";
import type { VocabEntryRow, VocabPreview, VocabSetRow } from "../../../preload/index";
import AppHeader, { type AppView } from "../components/AppHeader";
import BulkExtractModal from "../components/BulkExtractModal";
import DictionaryPanel from "../components/DictionaryPanel";
import SetsBar from "../components/SetsBar";
import VocabDetailModal from "../components/VocabDetailModal";
import { dayKey, dayLabel, timeLabel } from "../lib/date";
import { speak } from "../lib/speak";
import { styleTokens } from "../theme";
import Login from "./Login";
import Review from "./Review";
import Settings from "./Settings";

const UNASSIGNED = "__unassigned__";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<VocabEntryRow[]>([]);
  const [sets, setSets] = useState<VocabSetRow[]>([]);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<VocabEntryRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [text, setText] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<VocabPreview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<AppView>("list");
  const [bulkExtractOpen, setBulkExtractOpen] = useState(false);

  // Local read only (no network) — see authSession.ts — so login gating
  // never blocks app startup on connectivity, just on "have we ever
  // logged in and not logged out".
  useEffect(() => {
    window.api.auth.getSession().then((session) => setAuthed(!!session));
  }, []);

  async function refresh() {
    setEntries(await window.api.vocab.list());
  }

  async function refreshSets() {
    setSets(await window.api.vocabSet.list());
  }

  useEffect(() => {
    refresh();
    refreshSets();
  }, []);

  useEffect(() => {
    window.api.onVocabCreated((entry) => {
      setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev]));
    });
  }, []);

  // Only the "downloaded" state needs surfacing outside Settings — it's the
  // one moment that needs a user decision (restart now or later) regardless
  // of which page they're on; every other update state (checking/available/
  // error) is just passive status Settings already shows on its own.
  useEffect(() => {
    window.api.onUpdateStatus((status) => {
      if (status.state !== "downloaded") return;
      toast(
        (t) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <span>Đã tải bản cập nhật v{status.version}.</span>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                toast.dismiss(t.id);
                window.api.updater.quitAndInstall();
              }}
            >
              Khởi động lại
            </Button>
          </Stack>
        ),
        { duration: Infinity, icon: "🚀" },
      );
    });
  }, []);

  async function handleSearch() {
    if (!text.trim()) return;
    setLooking(true);
    setPreview(null);
    try {
      setPreview(await window.api.vocab.preview(text.trim()));
    } catch (err) {
      toast.error(`Tra từ thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLooking(false);
    }
  }

  async function handleSavePreview() {
    if (!preview) return;
    setSaving(true);
    try {
      await window.api.vocab.save(preview.result);
      setText("");
      setPreview(null);
      await refresh();
      toast.success("Đã lưu");
    } catch (err) {
      toast.error(`Lưu thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await window.api.vocab.delete(id);
    await refresh();
  }

  async function handleAssignSet(id: string, setId: string) {
    const resolved = setId === UNASSIGNED ? null : setId;
    await window.api.vocab.setSet(id, resolved);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, setId: resolved } : e)));
  }

  function handleUpdateEntry(updated: VocabEntryRow) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setDetailEntry(updated);
  }

  async function handleCreateSet(name: string) {
    await window.api.vocabSet.create(name);
    await refreshSets();
  }

  async function handleRenameSet(id: string, name: string) {
    await window.api.vocabSet.rename(id, name);
    await refreshSets();
  }

  async function handleDeleteSet(id: string) {
    await window.api.vocabSet.delete(id);
    if (activeSet === id) setActiveSet(null);
    await refreshSets();
    await refresh();
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await window.api.sync.run();
      toast.success(`Synced — pushed ${result.pushed}, pulled ${result.pulled}`);
      await refresh();
      await refreshSets();
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  if (authed === null) return null;

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  const bySet = activeSet === null ? entries : entries.filter((e) => e.setId === activeSet);
  const query = searchQuery.trim().toLowerCase();
  const visibleEntries = query
    ? bySet.filter(
        (e) =>
          e.sourceText.toLowerCase().includes(query) ||
          e.targetText.toLowerCase().includes(query) ||
          (e.note ?? "").toLowerCase().includes(query) ||
          e.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
    : bySet;
  const setOptions = [
    { value: UNASSIGNED, label: "Chưa phân loại" },
    ...sets.map((s) => ({ value: s.id, label: s.name })),
  ];

  // Most recent save date for a set (or across everything, for null) — more
  // useful in the sidebar than a raw "set last renamed" timestamp, since it
  // reflects actual vocab activity instead of bookkeeping.
  function latestDateFor(setId: string | null): string | null {
    const matching = setId === null ? entries : entries.filter((e) => e.setId === setId);
    if (matching.length === 0) return null;
    const latest = matching.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    return dayLabel(latest.createdAt);
  }

  // Groups consecutive same-day entries under one header — entries stay in
  // their existing (updatedAt desc) order within a group instead of being
  // re-sorted by createdAt, so moving/editing an entry doesn't reshuffle it
  // out of the day it was actually saved on.
  const entryGroups: { key: string; label: string; items: VocabEntryRow[] }[] = [];
  for (const entry of visibleEntries) {
    const key = dayKey(entry.createdAt);
    const lastGroup = entryGroups[entryGroups.length - 1];
    if (lastGroup && lastGroup.key === key) {
      lastGroup.items.push(entry);
    } else {
      entryGroups.push({ key, label: dayLabel(entry.createdAt), items: [entry] });
    }
  }

  return (
    <>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <AppHeader view={view} onChangeView={setView} onSync={handleSync} syncing={syncing} />

        {view === "review" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: "1rem" }}>
              <Review />
            </div>
          </div>
        )}

        {view === "settings" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <Settings onLogout={() => setAuthed(false)} />
          </div>
        )}

        {view === "list" && (
          <div
            style={{
              width: "100%",
              maxWidth: 960,
              margin: "0 auto",
              padding: "1.5rem 1.5rem 0",
              display: "flex",
              gap: 24,
              flex: 1,
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <Typography color="text.secondary" sx={{ marginTop: 0 }}>
                Copy a word anywhere, press the hotkey — or look one up here.
              </Typography>

              <Stack direction="row" sx={{ width: "100%", marginTop: 2 }}>
                <TextField
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Look up a word or phrase"
                  size="small"
                  fullWidth
                  sx={{ "& .MuiOutlinedInput-root": { borderTopRightRadius: 0, borderBottomRightRadius: 0 } }}
                />
                <Button
                  variant="contained"
                  loading={looking}
                  onClick={handleSearch}
                  sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, flexShrink: 0 }}
                >
                  Look up
                </Button>
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => setBulkExtractOpen(true)}
                sx={{ marginTop: 1, alignSelf: "flex-end", borderStyle: "dashed" }}
              >
                Trích xuất từ đoạn văn
              </Button>

              {/* Everything below the lookup box shares one scroll region — the
                  preview card can grow arbitrarily tall (long dictionary
                  entries), and without this it could push the entries list
                  past the window's bottom edge with no way to reach it, since
                  only this region (not the whole window) scrolls. */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {preview && (
                  <Card variant="outlined" sx={{ marginBottom: 2 }}>
                    <CardContent>
                      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
                        <Stack spacing={0.5}>
                          <span>
                            <Chip label={preview.result.sourceLang} color="primary" size="small" sx={{ marginRight: 0.5 }} />
                            {preview.result.sourceText}
                            {preview.result.sourceLang !== "vi" && (
                              <IconButton size="small" onClick={() => speak(preview.result.sourceText, preview.result.sourceLang)}>
                                <VolumeUpIcon fontSize="small" />
                              </IconButton>
                            )}
                          </span>
                          <span>
                            <Chip label={preview.result.targetLang} color="success" size="small" sx={{ marginRight: 0.5 }} />
                            {preview.result.targetText}
                            {preview.result.targetLang !== "vi" && (
                              <IconButton size="small" onClick={() => speak(preview.result.targetText, preview.result.targetLang)}>
                                <VolumeUpIcon fontSize="small" />
                              </IconButton>
                            )}
                          </span>
                          {preview.result.targetMeanings.length > 1 && (
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                              {preview.result.targetMeanings.slice(1).map((meaning) => (
                                <Chip key={meaning} label={meaning} size="small" variant="outlined" />
                              ))}
                            </Stack>
                          )}
                        </Stack>
                        <Button variant="contained" loading={saving} onClick={handleSavePreview}>
                          Lưu
                        </Button>
                      </Stack>
                      {preview.dictionary && <DictionaryPanel dictionary={preview.dictionary} />}
                    </CardContent>
                  </Card>
                )}

                <TextField
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm trong từ đã lưu..."
                  size="small"
                  fullWidth
                  sx={{ marginBottom: 2 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: searchQuery && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setSearchQuery("")}>
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                {visibleEntries.length === 0 && (
                  <Stack spacing={1} sx={{ alignItems: "center", padding: "2rem 0", color: "text.secondary" }}>
                    <InboxIcon fontSize="large" color="disabled" />
                    <Typography color="text.secondary">
                      {query ? "Không tìm thấy từ nào" : "No lookups yet"}
                    </Typography>
                  </Stack>
                )}
                {entryGroups.map((group) => (
                  <div key={group.key}>
                    <Typography color="text.secondary" sx={{ display: "block", margin: "12px 0 4px", fontWeight: 600 }}>
                      {group.label}
                    </Typography>
                    {group.items.map((entry) => (
                      <Box
                        key={entry.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          borderBottom: `1px solid ${styleTokens.borderColorLight}`,
                          padding: "8px 0",
                        }}
                      >
                        {/* onClick lives here, not further up — the actions to
                        the right (esp. Select's portaled dropdown) are a
                        sibling, not a DOM/React descendant of this box, so
                        clicking them can never reach this handler. */}
                        <Stack
                          spacing={0}
                          sx={{ cursor: "pointer", flex: 1, minWidth: 0, padding: "4px 8px", borderRadius: "6px" }}
                          onClick={() => setDetailEntry(entry)}
                        >
                          <span>
                            <Chip label={entry.sourceLang} color="primary" size="small" sx={{ marginRight: 0.5 }} />
                            {entry.sourceText}
                            {entry.sourceLang !== "vi" && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speak(entry.sourceText, entry.sourceLang);
                                }}
                              >
                                <VolumeUpIcon fontSize="small" />
                              </IconButton>
                            )}
                          </span>
                          <span>
                            <Chip label={entry.targetLang} color="success" size="small" sx={{ marginRight: 0.5 }} />
                            {entry.targetText}
                            {entry.targetLang !== "vi" && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speak(entry.targetText, entry.targetLang);
                                }}
                              >
                                <VolumeUpIcon fontSize="small" />
                              </IconButton>
                            )}
                            {entry.targetMeanings.length > 1 && (
                              <Typography component="span" color="text.secondary" sx={{ marginLeft: "4px" }}>
                                ({entry.targetMeanings.slice(1).join(", ")})
                              </Typography>
                            )}
                            <Typography
                              component="span"
                              color="text.secondary"
                              sx={{ marginLeft: "8px", fontSize: styleTokens.secondaryFontSize }}
                            >
                              {timeLabel(entry.createdAt)}
                            </Typography>
                          </span>
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
                          <Select
                            size="small"
                            variant="standard"
                            value={entry.setId ?? UNASSIGNED}
                            onChange={(e) => handleAssignSet(entry.id, e.target.value)}
                            sx={{ width: 140 }}
                          >
                            {setOptions.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                          <IconButton size="small" color="error" onClick={() => handleDelete(entry.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                width: 220,
                flexShrink: 0,
                borderLeft: `1px solid ${styleTokens.borderColorLight}`,
                paddingLeft: 20,
                paddingBottom: "1.5rem",
                overflowY: "auto",
              }}
            >
              <SetsBar
                sets={sets}
                countAll={entries.length}
                countFor={(setId) => entries.filter((e) => e.setId === setId).length}
                latestDateFor={latestDateFor}
                activeSet={activeSet}
                onSelect={setActiveSet}
                onCreate={handleCreateSet}
                onRename={handleRenameSet}
                onDelete={handleDeleteSet}
              />
            </div>
          </div>
        )}
      </div>

      <VocabDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onUpdate={handleUpdateEntry} />
      <BulkExtractModal
        open={bulkExtractOpen}
        onClose={() => setBulkExtractOpen(false)}
        entries={entries}
        onSaved={refresh}
      />
    </>
  );
}
