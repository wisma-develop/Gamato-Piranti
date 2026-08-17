import React from "react";
import { Copy } from "lucide-react";
import { Textarea, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

type BulkOp = "unique" | "sortAsc" | "sortDesc" | "shuffle" | "number" | "prefix" | "suffix";

const OPS: [BulkOp, string][] = [
  ["unique", "Hapus Duplikat"],
  ["sortAsc", "Sort A→Z"],
  ["sortDesc", "Sort Z→A"],
  ["shuffle", "Acak"],
  ["number", "Nomori"],
  ["prefix", "Tambah Prefix"],
  ["suffix", "Tambah Suffix"],
];

type BulkState = { bulkInput: string; bulkOutput: string; bulkInfo: string | null };

export const UtilityBulkText: React.FC = () => {
  // Input & hasil punya riwayat Undo/Redo. Mengetik digabung jadi satu
  // langkah setelah jeda; menjalankan operasi (Sort/Acak/dll.) langsung commit.
  const history = useHistoryState<BulkState>({ bulkInput: "", bulkOutput: "", bulkInfo: null });
  const { bulkInput, bulkOutput, bulkInfo } = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 600);
  const setBulkInput = (v: string) => {
    history.set((prev) => ({ ...prev, bulkInput: v }), { commit: false });
    scheduleCommit();
  };
  const setBulkOutput = (v: string) => {
    history.set((prev) => ({ ...prev, bulkOutput: v }), { commit: false });
    scheduleCommit();
  };

  const runBulkOp = (kind: BulkOp) => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.split(/\r?\n/);
    let result = [...lines];
    let info = "";
    if (kind === "unique") {
      const s = new Set<string>();
      result = [];
      lines.forEach((l) => {
        if (!s.has(l)) {
          s.add(l);
          result.push(l);
        }
      });
      info = "Duplikat dihapus.";
    } else if (kind === "sortAsc") {
      result = [...lines].sort((a, b) => a.localeCompare(b));
      info = "Diurutkan A→Z.";
    } else if (kind === "sortDesc") {
      result = [...lines].sort((a, b) => b.localeCompare(a));
      info = "Diurutkan Z→A.";
    } else if (kind === "shuffle") {
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      info = "Urutan diacak.";
    } else if (kind === "number") {
      result = lines.map((l, i) => `${i + 1}. ${l}`);
      info = "Baris dinomori.";
    } else if (kind === "prefix") {
      result = lines.map((l) => `[x] ${l}`);
      info = "Prefix ditambahkan.";
    } else if (kind === "suffix") {
      result = lines.map((l) => `${l} #`);
      info = "Suffix ditambahkan.";
    }
    history.set((prev) => ({ ...prev, bulkOutput: result.join("\n"), bulkInfo: info }));
  };

  return (
    <PanelCard title="Bulk Teks & Data Lab" subtitle="Manipulasi daftar teks — email, ID, nama, dll.">
      <div className="flex justify-end -mt-2 mb-1">
        <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <Textarea label="Input (satu item per baris)" rows={10} value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder={"item1\nitem2\nitem3"} />
          <div className="flex flex-wrap gap-2">
            {OPS.map(([k, l]) => (
              <Btn key={k} onClick={() => runBulkOp(k)} variant="secondary" className="text-xs py-1.5">{l}</Btn>
            ))}
          </div>
          {bulkInfo && <p className="text-xs text-green-600 dark:text-green-400 font-medium">{bulkInfo}</p>}
        </div>
        <div className="space-y-3">
          <Textarea label="Hasil" rows={10} value={bulkOutput} onChange={(e) => setBulkOutput(e.target.value)} placeholder="Hasil akan tampil di sini…" />
          <Btn onClick={() => copyToClipboard(bulkOutput)} variant="secondary" className="w-full text-xs gap-2">
            <Copy className="w-3.5 h-3.5" />Salin Hasil
          </Btn>
        </div>
      </div>
    </PanelCard>
  );
};
