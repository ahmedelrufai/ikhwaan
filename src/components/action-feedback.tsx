'use client';
import ConfirmationDialog from '@/components/confirmation-dialog';
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type FormHTMLAttributes, type ReactNode } from 'react';
function ActionError({ message, id }: { message: string; id: string }) {
    const ref = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (!message) return;
        ref.current?.focus({ preventScroll: true });
        ref.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, [message]);
    return message ? <p ref={ref} id={id} className="error action-error" role="alert" tabIndex={-1}>{message}</p> : null;
}
export function ActionForm({ children, onSubmit, confirm, className = '', ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & { onSubmit: (event: FormEvent<HTMLFormElement>) => unknown | Promise<unknown>; confirm?: string }) {
    const [error, setError] = useState(''), [pending, setPending] = useState(false);
    const errorId = useId();
    const [confirmationEvent, setConfirmationEvent] = useState<FormEvent<HTMLFormElement> | null>(null);
    const fields: ReactNode[] = [], buttons: ReactNode[] = [];
    Children.toArray(children).forEach(child => {
        if (isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(child) && child.type === 'button' && child.props.type !== 'button') buttons.push(child);
        else fields.push(child);
    });
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        if (confirm) {
            const form = event.currentTarget;
            setConfirmationEvent({ ...event, currentTarget: form, target: form, preventDefault: () => {} });
            return;
        }
        setError(''); setPending(true);
        try { await onSubmit(event); }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Try again.'); }
        finally { setPending(false); }
    }
    return <>{confirmationEvent && confirm && <ConfirmationDialog message={confirm} onClose={() => setConfirmationEvent(null)} onConfirm={() => onSubmit(confirmationEvent)}/>}<form {...props} className={'action-form ' + className} onSubmit={submit} aria-busy={pending} aria-describedby={error ? errorId : undefined} onInputCapture={event => { if (error) setError(''); props.onInputCapture?.(event); }}><fieldset disabled={pending} className="action-form-fields">{fields}</fieldset><div className="action-form-footer"><ActionError message={error} id={errorId}/><div className="action-form-actions">{buttons.map(button => isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(button) ? <span key={button.key} className="action-submit-wrap">{cloneElement(button, { disabled: pending || button.props.disabled, 'aria-busy': pending })}</span> : button)}</div></div></form></>;
}
export function ActionButton({ children, onAction, confirm, disabled, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & { onAction: () => unknown | Promise<unknown>; confirm?: string }) {
    const [error, setError] = useState(''), [pending, setPending] = useState(false);
    const errorId = useId();
    const [confirming, setConfirming] = useState(false);
    async function execute() {
        if (pending || disabled) return;
        setError(''); setPending(true);
        try { await onAction(); }
        finally { setPending(false); }
    }
    async function click() {
        if (pending || disabled) return;
        if (confirm) { setConfirming(true); return; }
        try { await execute(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this action.'); }
    }
    return <div className="action-control"><ActionError message={error} id={errorId}/><button {...props} type={props.type || 'button'} disabled={disabled || pending || confirming} aria-busy={pending} aria-describedby={error ? errorId : undefined} onClick={() => void click()}>{children}</button>{confirming && confirm && <ConfirmationDialog message={confirm} onConfirm={execute} onClose={() => setConfirming(false)}/>}</div>;
}
