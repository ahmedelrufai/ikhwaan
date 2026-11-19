'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
export default function ConfirmationDialog({ message, onConfirm, onClose }: { message: string; onConfirm: () => unknown | Promise<unknown>; onClose: () => void }) {
    const ref = useRef<HTMLDialogElement>(null);
    const [pending, setPending] = useState(false), [error, setError] = useState('');
    const titleId = useId(), messageId = useId();
    const running = useRef(false);
    useEffect(() => {
        const dialog = ref.current, trigger = document.activeElement;
        dialog?.showModal();
        return () => { dialog?.close(); queueMicrotask(() => { if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); }); };
    }, []);
    async function submit() {
        if (running.current) return;
        running.current = true; setPending(true); setError('');
        try { await onConfirm(); onClose(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this action.'); }
        finally { running.current = false; setPending(false); }
    }
    return <dialog ref={ref} className="confirmation-dialog" aria-labelledby={titleId} aria-describedby={messageId} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
        <div className="confirmation-body"><span className="confirmation-icon"><ShieldCheck size={22}/></span><button className="confirmation-close" type="button" aria-label="Close confirmation" disabled={pending} onClick={onClose}><X size={18}/></button><h2 id={titleId}>Confirm your action</h2><p id={messageId}>{message}</p>{error && <p className="error" role="alert">{error}</p>}</div>
        <footer className="confirmation-footer"><button className="button secondary" type="button" autoFocus disabled={pending} onClick={onClose}>Go back</button><button className="button primary" type="button" disabled={pending} aria-busy={pending} onClick={() => void submit()}>{pending ? 'Processing…' : 'Confirm'}</button></footer>
    </dialog>;
}
