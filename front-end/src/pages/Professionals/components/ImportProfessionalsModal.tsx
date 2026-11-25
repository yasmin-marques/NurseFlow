import { useRef, useState, type DragEvent } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Check, Download, Upload, X } from "../../../components/icons";
import {
    downloadImportTemplate,
    importProfessionals,
    previewFromError,
    previewProfessionalsImport,
    validateImportFile,
    type ImportPreview,
    type ImportResult,
    type ImportRow,
} from "../../../services/professionalsImport";

type Step = "select" | "validating" | "preview" | "importing" | "done";

type ImportProfessionalsModalProps = {
    onClose: () => void;
    /** Chamado após a importação gravar, para atualizar a listagem sem recarregar a página. */
    onImported: (result: ImportResult) => void;
};

const ACTION_BADGE: Record<ImportRow["acao"], { label: string; className: string }> = {
    criar: { label: "Novo", className: "bg-secondary text-primary-hover" },
    atualizar: { label: "Atualizar", className: "bg-badge-blue text-badge-blue-text" },
    sem_alteracao: { label: "Sem alterações", className: "bg-neutral text-text-muted" },
    invalido: { label: "Inválido", className: "bg-badge-red text-badge-red-text" },
};

const buttonFocus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function formatBytes(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
    return (
        <div className={`rounded-xl border px-3 py-2.5 ${tone === "danger" && value > 0 ? "border-badge-red-text/30 bg-badge-red" : "border-border bg-neutral"}`}>
            <dd className={`text-xl font-bold leading-none ${tone === "danger" && value > 0 ? "text-badge-red-text" : "text-text"}`}>{value}</dd>
            <dt className="mt-1.5 text-xs text-text-muted">{label}</dt>
        </div>
    );
}

function RowItem({ row }: { row: ImportRow }) {
    const badge = ACTION_BADGE[row.acao];
    return (
        <li className="rounded-xl border border-border bg-white px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{row.nome || "Sem nome"}</span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">Linha {row.linha} · CPF {row.cpf || "não informado"}</p>
            {row.erros.length > 0 ? (
                <ul className="mt-2 space-y-1">
                    {row.erros.map((error, index) => (
                        <li key={index} className="text-xs text-badge-red-text">
                            <span className="font-semibold">{error.campo}:</span> {error.mensagem}
                        </li>
                    ))}
                </ul>
            ) : null}
            {row.alteracoes.length > 0 ? (
                <ul className="mt-2 space-y-1" aria-label={`Alterações de ${row.nome}`}>
                    {row.alteracoes.map((change) => (
                        <li key={change.campo} className="text-xs text-text">
                            <span className="font-semibold">{change.campo}:</span>{" "}
                            <span className="text-text-muted line-through">{change.atual ?? "(vazio)"}</span>
                            <span aria-hidden="true"> → </span>
                            <span className="sr-only"> para </span>
                            <span className="font-semibold text-primary-hover">{change.novo ?? "(vazio)"}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
            {row.avisos.map((warning, index) => (
                <p key={index} className="mt-2 rounded-lg bg-warning px-2.5 py-1.5 text-xs text-warning-text">{warning}</p>
            ))}
        </li>
    );
}

function RowGroup({ title, rows, open }: { title: string; rows: ImportRow[]; open: boolean }) {
    if (rows.length === 0) return null;
    return (
        <details open={open} className="group rounded-xl">
            <summary className={`cursor-pointer rounded-lg py-1.5 text-sm font-bold text-text ${buttonFocus}`}>
                {title} <span className="font-normal text-text-muted">({rows.length})</span>
            </summary>
            <ul className="mt-2 space-y-2">{rows.map((row) => <RowItem key={row.linha} row={row} />)}</ul>
        </details>
    );
}

export function ImportProfessionalsModal({ onClose, onImported }: ImportProfessionalsModalProps) {
    const [step, setStep] = useState<Step>("select");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState("");
    const [dragging, setDragging] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const request = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const busy = step === "validating" || step === "importing";

    const close = () => {
        if (step !== "importing") onClose();
    };

    const reset = () => {
        request.current += 1;
        setFile(null);
        setPreview(null);
        setError("");
        setStep("select");
        if (inputRef.current) inputRef.current.value = "";
    };

    const selectFile = (selected: File | undefined) => {
        if (!selected || busy) return;
        const invalid = validateImportFile(selected);
        if (invalid) {
            setError(invalid);
            return;
        }
        const id = ++request.current;
        setError("");
        setFile(selected);
        setPreview(null);
        setStep("validating");
        previewProfessionalsImport(selected)
            .then((data) => {
                if (request.current !== id) return;
                setPreview(data);
                setStep("preview");
            })
            .catch((err: Error) => {
                if (request.current !== id) return;
                setFile(null);
                setError(err.message);
                setStep("select");
            });
    };

    const confirm = async () => {
        if (!file) return;
        const id = ++request.current;
        setError("");
        setStep("importing");
        try {
            const data = await importProfessionals(file);
            if (request.current !== id) return;
            setResult(data);
            setStep("done");
            onImported(data);
        } catch (err) {
            if (request.current !== id) return;
            const invalidPreview = previewFromError(err);
            if (invalidPreview) setPreview(invalidPreview);
            setError(err instanceof Error ? `${err.message} Nada foi importado.` : "Não foi possível importar a planilha. Nada foi importado.");
            setStep("preview");
        }
    };

    const handleTemplate = async () => {
        setDownloading(true);
        setError("");
        try {
            await downloadImportTemplate();
        } catch {
            setError("Não foi possível baixar o modelo de planilha.");
        } finally {
            setDownloading(false);
        }
    };

    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setDragging(false);
        selectFile(event.dataTransfer.files[0]);
    };

    const groups = (action: ImportRow["acao"]) => preview?.linhas.filter((row) => row.acao === action) ?? [];
    const toApply = (preview?.resumo.novos ?? 0) + (preview?.resumo.atualizar ?? 0);
    const canConfirm = step === "preview" && preview?.podeConfirmar === true && toApply > 0;

    const header = (
        <div className="flex items-start gap-4 bg-card-header px-5 py-4">
            <div className="min-w-0 flex-1">
                <h2 id="import-professionals-title" className="text-lg font-bold text-text">Importar profissionais</h2>
                <p className="mt-1 text-xs text-text-muted">
                    Cadastre novos profissionais e atualize os existentes a partir de uma planilha .xlsx.
                </p>
            </div>
            <button
                type="button"
                onClick={close}
                disabled={step === "importing"}
                aria-label="Fechar"
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text hover:bg-neutral disabled:opacity-50 ${buttonFocus}`}
            >
                <X className="size-4" />
            </button>
        </div>
    );

    return (
        <Modal id="import-professionals" labelledBy="import-professionals-title" onClose={close} escapeDisabled={step === "importing"} widthClassName="max-w-2xl" header={header}>
            <div className="space-y-5 px-5 py-5">
                {step === "done" && result ? (
                    <div role="status" className="space-y-4">
                        <div className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-primary-hover">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white"><Check className="size-4" strokeWidth={3} /></span>
                            <p className="text-sm font-semibold">Importação concluída com sucesso.</p>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <SummaryCard label="Total na planilha" value={result.resumo.total} />
                            <SummaryCard label="Cadastrados" value={result.resumo.cadastrados} />
                            <SummaryCard label="Atualizados" value={result.resumo.atualizados} />
                            <SummaryCard label="Ignorados (sem alterações)" value={result.resumo.ignorados} />
                        </dl>
                    </div>
                ) : (
                    <>
                        <section aria-labelledby="import-how" className="space-y-2 text-sm text-text">
                            <h3 id="import-how" className="font-bold">Como funciona</h3>
                            <ol className="list-decimal space-y-1 pl-5 text-text-muted">
                                <li>Baixe o modelo, preencha um profissional por linha e salve como .xlsx.</li>
                                <li>O <strong className="text-text">CPF</strong> identifica o profissional: se já existir, ele é atualizado; senão, é cadastrado.</li>
                                <li>Células vazias não apagam dados já cadastrados, e quem não está na planilha não é alterado.</li>
                                <li>Antes de gravar, você confere um resumo e os erros por linha. Só importa se tudo estiver válido.</li>
                            </ol>
                            <button
                                type="button"
                                onClick={handleTemplate}
                                disabled={downloading}
                                className={`mt-1 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-text hover:bg-neutral disabled:opacity-60 ${buttonFocus}`}
                            >
                                <Download className="size-4 shrink-0" />
                                {downloading ? "Baixando..." : "Baixar modelo de planilha"}
                            </button>
                        </section>

                        {step === "select" || step === "validating" ? (
                            <label
                                htmlFor="import-professionals-file"
                                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary motion-reduce:transition-none ${dragging ? "border-primary bg-secondary" : "border-border bg-neutral hover:bg-card-header"} ${busy ? "pointer-events-none opacity-70" : ""}`}
                            >
                                <Upload className="size-6 text-primary" />
                                <span className="text-sm font-semibold text-text">
                                    {step === "validating" ? "Validando planilha..." : "Arraste o arquivo aqui ou clique para selecionar"}
                                </span>
                                <span className="text-xs text-text-muted">Somente .xlsx, até 2 MB e 200 profissionais</span>
                                <input
                                    ref={inputRef}
                                    id="import-professionals-file"
                                    type="file"
                                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    className="sr-only"
                                    disabled={busy}
                                    onChange={(event) => selectFile(event.target.files?.[0])}
                                />
                            </label>
                        ) : file ? (
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-neutral px-3.5 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-text">{file.name}</p>
                                    <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={reset}
                                    disabled={step === "importing"}
                                    className={`rounded-lg px-2.5 py-1.5 !text-[12px] font-semibold text-primary-hover underline disabled:opacity-50 ${buttonFocus}`}
                                >
                                    Trocar arquivo
                                </button>
                            </div>
                        ) : null}

                        {step === "validating" ? <p role="status" className="text-sm text-text-muted">Validando a planilha, isso pode levar alguns segundos...</p> : null}
                        {step === "importing" ? <p role="status" className="text-sm text-text-muted">Importando profissionais, não feche esta janela...</p> : null}
                        {error ? <p role="alert" className="rounded-xl bg-badge-red px-3.5 py-2.5 text-sm text-badge-red-text">{error}</p> : null}

                        {preview && (step === "preview" || step === "importing") ? (
                            <section aria-label="Resumo da importação" className="space-y-4">
                                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                    <SummaryCard label="Identificados" value={preview.resumo.total} />
                                    <SummaryCard label="Novos" value={preview.resumo.novos} />
                                    <SummaryCard label="Atualizar" value={preview.resumo.atualizar} />
                                    <SummaryCard label="Sem alterações" value={preview.resumo.semAlteracao} />
                                    <SummaryCard label="Inválidos" value={preview.resumo.invalidos} tone="danger" />
                                </dl>
                                {!preview.podeConfirmar ? (
                                    <p role="alert" className="text-sm font-semibold text-badge-red-text">
                                        Corrija os erros na planilha e selecione o arquivo novamente. A importação só é liberada quando não houver registros inválidos.
                                    </p>
                                ) : toApply === 0 ? (
                                    <p className="text-sm text-text-muted">Nenhum cadastro novo ou alteração a importar: todos os profissionais já estão atualizados.</p>
                                ) : null}
                                <div className="space-y-3">
                                    <RowGroup title="Registros inválidos" rows={groups("invalido")} open />
                                    <RowGroup title="Serão atualizados" rows={groups("atualizar")} open />
                                    <RowGroup title="Serão cadastrados" rows={groups("criar")} open={groups("invalido").length === 0 && groups("atualizar").length === 0} />
                                    <RowGroup title="Sem alterações (serão ignorados)" rows={groups("sem_alteracao")} open={false} />
                                </div>
                            </section>
                        ) : null}
                    </>
                )}
            </div>
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-surface px-5 py-3">
                {step === "done" ? (
                    <button type="button" onClick={onClose} className={`inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover ${buttonFocus}`}>
                        Concluir
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={close}
                            disabled={step === "importing"}
                            className={`inline-flex h-11 items-center rounded-xl border border-border bg-white px-5 text-sm font-semibold text-text hover:bg-neutral disabled:opacity-50 ${buttonFocus}`}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={confirm}
                            disabled={!canConfirm}
                            className={`inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocus}`}
                        >
                            <Upload className="size-4 shrink-0" />
                            {step === "importing" ? "Importando..." : "Importar"}
                        </button>
                    </>
                )}
            </div>
        </Modal>
    );
}
